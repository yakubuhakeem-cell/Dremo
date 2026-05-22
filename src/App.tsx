import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import RegisterView from './components/RegisterView';
import InventoryView from './components/InventoryView';
import AnalyticsView from './components/AnalyticsView';
import MacroView from './components/MacroView';
import AuthModal from './components/AuthModal';
import { INITIAL_PRODUCTS, MACRO_PRESETS } from './data';
import { Product, CartItem, Transaction } from './types';
import {
  auth,
  db,
  googleProvider,
  signInWithPopup,
  signOut,
  handleFirestoreError,
  OperationType,
} from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';

// In-memory fallback if localStorage is sandboxed/disabled in preview iframe
const memoryStorage: Record<string, string> = {};

const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn("localStorage read access blocked or failed:", e);
      return memoryStorage[key] || null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn("localStorage write access blocked or failed:", e);
      memoryStorage[key] = value;
    }
  }
};

export default function App() {
  const [currentView, setView] = useState<string>('register');
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [categories, setCategories] = useState<string[]>(['Cafe', 'Workspace', 'Goods']);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline'>('offline');
  const [currentUser, setCurrentUser] = useState<(User & { isLocalSandbox?: boolean }) | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const isCloudSynced = currentUser && !currentUser.isLocalSandbox;

  // Sync back to local storage only if offline/unauthenticated/sandboxed to retain edits
  useEffect(() => {
    if (!isCloudSynced) {
      try {
        safeStorage.setItem('dremo_products', JSON.stringify(products));
      } catch (e) {
        console.warn("Failed to set products in storage:", e);
      }
    }
  }, [products, isCloudSynced]);

  useEffect(() => {
    if (!isCloudSynced) {
      try {
        safeStorage.setItem('dremo_categories', JSON.stringify(categories));
      } catch (e) {
        console.warn("Failed to set categories in storage:", e);
      }
    }
  }, [categories, isCloudSynced]);

  useEffect(() => {
    if (!isCloudSynced) {
      try {
        safeStorage.setItem('dremo_transactions', JSON.stringify(transactions));
      } catch (e) {
        console.warn("Failed to set transactions in storage:", e);
      }
    }
  }, [transactions, isCloudSynced]);

  // Firebase auth state observer (only active if not in virtual local sandbox)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        setSyncStatus('synced');
      } else {
        setCurrentUser(prev => prev?.isLocalSandbox ? prev : null);
        if (!currentUser?.isLocalSandbox) {
          setSyncStatus('offline');
        }
      }
    });
    return () => unsubscribe();
  }, [currentUser?.isLocalSandbox]);

  // Products synchronization listener
  useEffect(() => {
    if (!isCloudSynced) {
      try {
        const local = safeStorage.getItem('dremo_products');
        setProducts(local ? JSON.parse(local) : INITIAL_PRODUCTS);
      } catch (e) {
        setProducts(INITIAL_PRODUCTS);
      }
      return;
    }

    setSyncStatus('syncing');
    const path = 'products';
    const unsub = onSnapshot(collection(db, path), (snapshot) => {
      if (snapshot.empty) {
        // Seed catalog to active Firestore instance
        INITIAL_PRODUCTS.forEach(async (p) => {
          try {
            await setDoc(doc(db, 'products', p.id), p);
          } catch (err) {
            console.error("Direct bootstrap write error:", err);
          }
        });
      } else {
        const list: Product[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as Product);
        });
        setProducts(list);
      }
      setSyncStatus('synced');
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsub();
  }, [isCloudSynced]);

  // Categories synchronization listener
  useEffect(() => {
    if (!isCloudSynced) {
      try {
        const local = safeStorage.getItem('dremo_categories');
        setCategories(local ? JSON.parse(local) : ['Cafe', 'Workspace', 'Goods']);
      } catch (e) {
        setCategories(['Cafe', 'Workspace', 'Goods']);
      }
      return;
    }

    setSyncStatus('syncing');
    const path = 'categories';
    const unsub = onSnapshot(collection(db, path), (snapshot) => {
      if (snapshot.empty) {
        const defaults = ['Cafe', 'Workspace', 'Goods'];
        defaults.forEach(async (cat) => {
          try {
            await setDoc(doc(db, 'categories', cat), { id: cat, name: cat });
          } catch (err) {
            console.error("Direct bootstrap write error:", err);
          }
        });
      } else {
        const list: string[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.id);
        });
        setCategories(list);
      }
      setSyncStatus('synced');
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsub();
  }, [isCloudSynced]);

  // Transactions database listener
  useEffect(() => {
    if (!isCloudSynced) {
      try {
        const local = safeStorage.getItem('dremo_transactions');
        setTransactions(local ? JSON.parse(local) : []);
      } catch (e) {
        setTransactions([]);
      }
      return;
    }

    setSyncStatus('syncing');
    const path = 'transactions';
    const unsub = onSnapshot(collection(db, path), (snapshot) => {
      const list: Transaction[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as Transaction);
      });
      // Order reverse chronologically by timestamp
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setTransactions(list);
      setSyncStatus('synced');
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsub();
  }, [isCloudSynced]);

  // User auth action triggers
  const handleLogin = () => {
    setIsAuthModalOpen(true);
  };

  const handleGoogleSignIn = async () => {
    try {
      setSyncStatus('syncing');
      await signInWithPopup(auth, googleProvider);
      setSyncStatus('synced');
    } catch (e) {
      console.error("Auth PopUp error: ", e);
      setSyncStatus('offline');
      throw e;
    }
  };

  const handleAuthSuccess = (user: any) => {
    setCurrentUser(user);
    setSyncStatus(user.isLocalSandbox ? 'offline' : 'synced');
  };

  const handleLogout = async () => {
    try {
      setSyncStatus('syncing');
      if (currentUser?.isLocalSandbox) {
        setCurrentUser(null);
        setSyncStatus('offline');
      } else {
        await signOut(auth);
        setSyncStatus('offline');
      }
    } catch (e) {
      console.error("Log out error: ", e);
    }
  };

  // Operations: Category actions
  const addCategory = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    if (isCloudSynced) {
      setSyncStatus('syncing');
      const path = 'categories';
      try {
        await setDoc(doc(db, path, trimmed), { id: trimmed, name: trimmed });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `${path}/${trimmed}`);
      }
    } else {
      setCategories(prev => {
        if (prev.includes(trimmed)) return prev;
        return [...prev, trimmed];
      });
    }
  };

  const updateCategory = async (oldName: string, newName: string) => {
    const trimmedNew = newName.trim();
    if (!oldName || !trimmedNew || oldName === trimmedNew) return;

    if (isCloudSynced) {
      setSyncStatus('syncing');
      try {
        await setDoc(doc(db, 'categories', trimmedNew), { id: trimmedNew, name: trimmedNew });
        const matching = products.filter(p => p.category === oldName);
        for (const p of matching) {
          await setDoc(doc(db, 'products', p.id), { ...p, category: trimmedNew });
        }
        await deleteDoc(doc(db, 'categories', oldName));
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `categories/${oldName}`);
      }
    } else {
      setCategories(prev => prev.map(c => c === oldName ? trimmedNew : c));
      setProducts(prev => prev.map(p => p.category === oldName ? { ...p, category: trimmedNew } : p));
      setCart(prev => prev.map(item => item.product.category === oldName ? { ...item, product: { ...item.product, category: trimmedNew } } : item));
    }
  };

  const deleteCategory = async (categoryName: string) => {
    if (isCloudSynced) {
      setSyncStatus('syncing');
      try {
        const matching = products.filter(p => p.category === categoryName);
        for (const p of matching) {
          await setDoc(doc(db, 'products', p.id), { ...p, category: 'Uncategorized' });
        }
        await deleteDoc(doc(db, 'categories', categoryName));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `categories/${categoryName}`);
      }
    } else {
      setCategories(prev => prev.filter(c => c !== categoryName));
      setProducts(prev => prev.map(p => p.category === categoryName ? { ...p, category: 'Uncategorized' } : p));
      setCart(prev => prev.map(item => item.product.category === categoryName ? { ...item, product: { ...item.product, category: 'Uncategorized' } } : item));
    }
  };

  // Operations: Cart actions
  const addToCart = (product: Product) => {
    if (product.stock <= 0) return;

    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });

    setProducts(prev =>
      prev.map(p => (p.id === product.id ? { ...p, stock: p.stock - 1 } : p))
    );
  };

  const updateQuantity = (productId: string, quantity: number) => {
    const matchCartItem = cart.find(item => item.product.id === productId);
    if (!matchCartItem) return;

    const diff = quantity - matchCartItem.quantity;
    const matchProduct = products.find(p => p.id === productId);

    if (!matchProduct && diff > 0) return;
    if (diff > 0 && matchProduct && matchProduct.stock < diff) return;

    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart(prev =>
      prev.map(item =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );

    setProducts(prev =>
      prev.map(p => (p.id === productId ? { ...p, stock: p.stock - diff } : p))
    );
  };

  const removeFromCart = (productId: string) => {
    const matchCartItem = cart.find(item => item.product.id === productId);
    if (!matchCartItem) return;

    setProducts(prev =>
      prev.map(p =>
        p.id === productId ? { ...p, stock: p.stock + matchCartItem.quantity } : p
      )
    );

    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const clearCart = () => {
    setProducts(prev => {
      let updated = [...prev];
      cart.forEach(item => {
        updated = updated.map(p =>
          p.id === item.product.id ? { ...p, stock: p.stock + item.quantity } : p
        );
      });
      return updated;
    });
    setCart([]);
  };

  const checkout = async (
    paymentMethod: Transaction['paymentMethod'],
    discount: number,
    taxRate: number,
    cashTendered?: number
  ): Promise<Transaction | null> => {
    if (cart.length === 0) return null;

    const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    const discountAmount = (subtotal * discount) / 100;
    const taxable = subtotal - discountAmount;
    const tax = (taxable * taxRate) / 100;
    const total = taxable + tax;

    const nextRowIndex = transactions.length + 2;

    const newTx: Transaction = {
      id: `DRM-${Date.now().toString().slice(-6)}`,
      items: cart.map(item => ({
        productId: item.product.id,
        name: item.product.name,
        price: item.product.price,
        quantity: item.quantity
      })),
      subtotal,
      tax,
      discount,
      total,
      paymentMethod,
      timestamp: new Date().toISOString(),
      cashierName: currentUser ? (currentUser.displayName || currentUser.email || 'Yakubu Hakeem') : 'Yakubu Hakeem',
      excelRowIndex: nextRowIndex
    };

    if (isCloudSynced) {
      setSyncStatus('syncing');
      try {
        await setDoc(doc(db, 'transactions', newTx.id), newTx);

        // Update product configurations stock state in cloud catalog
        for (const item of cart) {
          const matchingProduct = products.find(p => p.id === item.product.id);
          if (matchingProduct) {
            await setDoc(doc(db, 'products', item.product.id), matchingProduct);
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `transactions/${newTx.id}`);
      }
    } else {
      setTransactions(prev => [newTx, ...prev]);
    }

    setCart([]);
    
    setSyncStatus('syncing');
    setTimeout(() => {
      setSyncStatus('synced');
    }, 1200);

    return newTx;
  };

  // Inventory master modifiers
  const addProduct = async (newP: Omit<Product, 'id'>) => {
    const pid = `p-${Date.now()}`;
    const productData: Product = { ...newP, id: pid };

    if (isCloudSynced) {
      setSyncStatus('syncing');
      try {
        await setDoc(doc(db, 'products', pid), productData);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `products/${pid}`);
      }
    } else {
      setProducts(prev => [...prev, productData]);
    }
  };

  const updateStock = async (productId: string, newStock: number) => {
    const val = Math.max(0, newStock);
    if (isCloudSynced) {
      setSyncStatus('syncing');
      try {
        const target = products.find(p => p.id === productId);
        if (target) {
          await setDoc(doc(db, 'products', productId), { ...target, stock: val });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `products/${productId}`);
      }
    } else {
      setProducts(prev =>
        prev.map(p => (p.id === productId ? { ...p, stock: val } : p))
      );
    }
  };

  const updateProduct = async (updatedP: Product) => {
    if (isCloudSynced) {
      setSyncStatus('syncing');
      try {
        await setDoc(doc(db, 'products', updatedP.id), updatedP);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `products/${updatedP.id}`);
      }
    } else {
      setProducts(prev => prev.map(p => (p.id === updatedP.id ? updatedP : p)));
    }
  };

  const deleteProduct = async (productId: string) => {
    if (isCloudSynced) {
      setSyncStatus('syncing');
      try {
        await deleteDoc(doc(db, 'products', productId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `products/${productId}`);
      }
    } else {
      setProducts(prev => prev.filter(p => p.id !== productId));
    }
  };

  const handleForceRecalcSync = () => {
    setSyncStatus('syncing');
    setTimeout(() => {
      setSyncStatus('synced');
    }, 1500);
  };

  // CSV Exporters to easily copy-paste into Excel tables
  const exportTransactionsCSV = () => {
    if (transactions.length === 0) {
      alert("Awaiting transactions to write sales spreadsheets.");
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Timestamp,Transaction ID,Subtotal,Tax,Discount,Total Revenue,Payment Method,Excel Row Index\r\n";

    transactions.forEach(tx => {
      const row = [
        tx.timestamp,
        tx.id,
        tx.subtotal.toFixed(2),
        tx.tax.toFixed(2),
        tx.discount,
        tx.total.toFixed(2),
        tx.paymentMethod,
        tx.excelRowIndex || 2
      ].join(",");
      csvContent += row + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `dremo_pos_sales_workbook_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportInventoryCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "SKU,Product Name,Category,Cost Price,Sell Price,Current Stock,Min Safety Stock\r\n";

    products.forEach(p => {
      const row = [
        p.sku,
        `"${p.name.replace(/"/g, '""')}"`,
        p.category,
        p.cost.toFixed(2),
        p.price.toFixed(2),
        p.stock,
        p.minStock
      ].join(",");
      csvContent += row + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `dremo_pos_inventory_workbook_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-900 font-sans antialiased text-slate-800">
      
      {/* Drawer Sidebar Control Rail */}
      <Sidebar
        currentView={currentView}
        setView={setView}
        syncStatus={syncStatus}
        onForceSync={handleForceRecalcSync}
        txCount={transactions.length}
        currentUser={currentUser}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />

      {/* Main Container Portal */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-white rounded-l-3xl shadow-2xl relative">
        {currentView === 'register' && (
          <RegisterView
            products={products}
            categories={categories}
            cart={cart}
            addToCart={addToCart}
            updateQuantity={updateQuantity}
            removeFromCart={removeFromCart}
            clearCart={clearCart}
            checkout={checkout}
          />
        )}

        {currentView === 'inventory' && (
          <InventoryView
            products={products}
            categories={categories}
            addCategory={addCategory}
            updateCategory={updateCategory}
            deleteCategory={deleteCategory}
            addProduct={addProduct}
            updateStock={updateStock}
            updateProduct={updateProduct}
            deleteProduct={deleteProduct}
            onExportInventoryCSV={exportInventoryCSV}
          />
        )}

        {currentView === 'analytics' && (
          <AnalyticsView
            transactions={transactions}
            products={products}
            onExportTransactionsCSV={exportTransactionsCSV}
          />
        )}

        {currentView === 'macros' && (
          <MacroView
            presets={MACRO_PRESETS}
          />
        )}
      </main>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
        onGoogleSignIn={handleGoogleSignIn}
      />
    </div>
  );
}
