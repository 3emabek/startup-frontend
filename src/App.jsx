import { useState, useEffect, useRef } from "react";

const API = "https://startup-backend-production-fc80.up.railway.app/api";

// ── API helpers ────────────────────────────────────────
const api = {
  get: (url) => fetch(API + url).then(r => r.json()),
  post: (url, body) => fetch(API + url, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body) }).then(r => r.json()),
  postForm: (url, form) => fetch(API + url, { method:"POST", body: form }).then(r => r.json()),
  putForm: (url, form) => fetch(API + url, { method:"PUT", body: form }).then(r => r.json()),
  patch: (url, body) => fetch(API + url, { method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body) }).then(r => r.json()),
  del: (url) => fetch(API + url, { method:"DELETE" }).then(r => r.json()),
};

const STATUS_COLOR = { pending:"#f59e0b", confirmed:"#3b82f6", delivered:"#10b981", cancelled:"#ef4444" };
const STATUS_LABEL = { pending:"Ожидает", confirmed:"Подтверждён", delivered:"Доставлен", cancelled:"Отменён" };
const CATEGORY_EMOJI = { "Бакалея":"🌾","Масла":"🫙","Напитки":"☕","Приправы":"🧂","Другое":"📦" };

// ── Reusable UI ────────────────────────────────────────
const Toast = ({ toast }) => toast ? (
  <div style={{ position:"fixed",bottom:88,left:"50%",transform:"translateX(-50%)",
    background: toast.type==="error" ? "rgba(239,68,68,.15)" : "rgba(110,231,183,.15)",
    color: toast.type==="error" ? "#ef4444" : "#6ee7b7",
    border:`1px solid ${toast.type==="error"?"#ef444444":"#6ee7b744"}`,
    backdropFilter:"blur(12px)",borderRadius:14,padding:"10px 22px",
    fontWeight:800,fontSize:13,zIndex:300,whiteSpace:"nowrap",
    boxShadow:"0 8px 32px rgba(0,0,0,.5)",animation:"popIn .25s ease" }}>
    {toast.msg}
  </div>
) : null;

const PhotoPlaceholder = ({ category, size = 56 }) => (
  <div style={{ width:size,height:size,borderRadius:12,background:"#252836",
    display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.4,flexShrink:0 }}>
    {CATEGORY_EMOJI[category] || "📦"}
  </div>
);

const StockBar = ({ stock, minStock }) => {
  const pct = Math.min(100, (stock / Math.max(minStock * 2, 1)) * 100);
  const color = stock <= minStock ? "#ef4444" : stock <= minStock * 1.5 ? "#f59e0b" : "#6ee7b7";
  return (
    <div style={{ background:"#1e2133",borderRadius:6,height:5,overflow:"hidden",flex:1 }}>
      <div style={{ width:`${pct}%`,background:color,height:"100%",borderRadius:6,transition:"width .6s cubic-bezier(.4,0,.2,1)" }}/>
    </div>
  );
};

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [cart, setCart] = useState({});
  const [selectedStore, setSelectedStore] = useState(null);
  const [productModal, setProductModal] = useState(null); // null | "add" | product obj
  const [orderModal, setOrderModal] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const photoInputRef = useRef();

  const [form, setForm] = useState({ name:"",unit:"",stock:"",minStock:"",price:"",category:"Бакалея",photo:null });

  const unread = notifications.filter(n => !n.read).length;

  const showToast = (msg, type="success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Load data ────────────────────────────────────────
  const loadAll = async () => {
    try {
      setLoading(true);
      const [p, o, n, s] = await Promise.all([
        api.get("/products"), api.get("/orders"),
        api.get("/notifications"), api.get("/stores"),
      ]);
      if (p.success) setProducts(p.data);
      if (o.success) setOrders(o.data);
      if (n.success) setNotifications(n.data);
      if (s.success) { setStores(s.data); setSelectedStore(s.data[0]); }
    } catch { showToast("Сервер недоступен", "error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadAll(); }, []);

  // ── Photo input handler ──────────────────────────────
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setForm(f => ({ ...f, photo: file }));
    const url = URL.createObjectURL(file);
    setPhotoPreview(url);
  };

  const openAddModal = () => {
    setForm({ name:"",unit:"",stock:"",minStock:"",price:"",category:"Бакалея",photo:null });
    setPhotoPreview(null);
    setProductModal("add");
  };

  const openEditModal = (product) => {
    setForm({ name:product.name,unit:product.unit,stock:product.stock,minStock:product.minStock,price:product.price,category:product.category,photo:null });
    setPhotoPreview(product.photoUrl || null);
    setProductModal(product);
  };

  // ── Save product ─────────────────────────────────────
  const saveProduct = async () => {
    if (!form.name || !form.stock) return showToast("Заполните название и остаток", "error");

    const fd = new FormData();
    fd.append("name", form.name);
    fd.append("unit", form.unit);
    fd.append("stock", form.stock);
    fd.append("minStock", form.minStock || "0");
    fd.append("price", form.price || "0");
    fd.append("category", form.category);
    if (form.photo) fd.append("photo", form.photo);

    try {
      let res;
      if (productModal === "add") {
        res = await api.postForm("/products", fd);
      } else {
        res = await api.putForm(`/products/${productModal.id}`, fd);
      }
      if (res.success) {
        await loadAll();
        setProductModal(null);
        showToast(productModal === "add" ? "Товар добавлен ✓" : "Товар обновлён ✓");
      } else {
        showToast(res.message || "Ошибка", "error");
      }
    } catch { showToast("Ошибка соединения", "error"); }
  };

  // ── Delete photo ─────────────────────────────────────
  const deletePhoto = async (productId) => {
    try {
      await api.del(`/products/${productId}/photo`);
      setPhotoPreview(null);
      setForm(f => ({ ...f, photo: null }));
      await loadAll();
      showToast("Фото удалено");
    } catch { showToast("Ошибка", "error"); }
  };

  // ── Stock update ─────────────────────────────────────
  const updateStock = async (id, val) => {
    try {
      const res = await api.patch(`/products/${id}/stock`, { stock: val });
      if (res.success) setProducts(prev => prev.map(p => p.id === id ? { ...p, stock: res.data.stock } : p));
    } catch { showToast("Ошибка", "error"); }
  };

  // ── Place order ──────────────────────────────────────
  const placeOrder = async () => {
    const items = Object.entries(cart).map(([id, qty]) => {
      const p = products.find(p => p.id === id);
      return { productId: id, name: p.name, qty, price: p.price };
    });
    if (!items.length) return showToast("Добавьте товары", "error");
    try {
      const res = await api.post("/orders", { storeId: selectedStore.id, storeName: selectedStore.name, items });
      if (res.success) {
        setCart({});
        await loadAll();
        showToast(`Заказ #${res.data.id.slice(0,8)} оформлен!`);
        setTab("history");
      }
    } catch { showToast("Ошибка", "error"); }
  };

  // ── Order status ─────────────────────────────────────
  const changeStatus = async (id, status) => {
    try {
      const res = await api.patch(`/orders/${id}/status`, { status });
      if (res.success) { setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o)); showToast("Статус обновлён"); }
    } catch { showToast("Ошибка", "error"); }
  };

  // ── Mark notifications read ──────────────────────────
  const markAllRead = async () => {
    try {
      await api.patch("/notifications/read-all", {});
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch {}
  };

  const lowStock = products.filter(p => p.stock <= p.minStock);
  const cartTotal = Object.entries(cart).reduce((s, [id, q]) => s + (products.find(p=>p.id===id)?.price||0)*q, 0);
  const cartCount = Object.values(cart).reduce((a,b)=>a+b,0);

  if (loading) return (
    <div style={{ background:"#0c0e17",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16 }}>
      <div style={{ width:48,height:48,border:"3px solid #1e2133",borderTopColor:"#6ee7b7",borderRadius:"50%",animation:"spin 1s linear infinite" }}/>
      <div style={{ color:"#4a5177",fontSize:13,fontWeight:700 }}>Загрузка данных...</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ fontFamily:"'Sora',sans-serif",background:"#0c0e17",minHeight:"100vh",color:"#e2e8f0",position:"relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:#0c0e17}::-webkit-scrollbar-thumb{background:#2a2d3e;border-radius:4px}
        .card{background:#13162080;border:1px solid #1e2133;border-radius:18px;padding:16px;margin-bottom:10px;backdrop-filter:blur(8px)}
        .card:active{transform:scale(.99)}
        .btn{border:none;border-radius:12px;padding:11px 20px;font-family:inherit;font-weight:800;font-size:13px;cursor:pointer;transition:all .15s}
        .btn-green{background:#6ee7b7;color:#0c0e17}
        .btn-green:hover{background:#5cd4a4;transform:translateY(-1px)}
        .btn-ghost{background:#1e2133;color:#94a3b8}
        .btn-sm{padding:7px 14px;font-size:12px}
        .input{background:#1a1d2e;border:1.5px solid #2a2d3e;border-radius:12px;padding:11px 14px;color:#e2e8f0;font-family:inherit;font-size:13px;width:100%;outline:none;transition:border .2s}
        .input:focus{border-color:#6ee7b7}
        select.input{-webkit-appearance:none}
        .nav-btn{background:none;border:none;cursor:pointer;padding:8px 12px 6px;display:flex;flex-direction:column;align-items:center;gap:2px;font-size:10px;font-family:inherit;font-weight:800;color:#3a3f5c;transition:color .2s;letter-spacing:.4px;position:relative}
        .nav-btn.active{color:#6ee7b7}
        .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:100;display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(6px)}
        .modal{background:#13162099;backdrop-filter:blur(24px);border:1px solid #1e2133;border-radius:24px 24px 0 0;padding:24px;width:100%;max-width:480px;max-height:88vh;overflow-y:auto}
        .tag{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:800}
        .pulse{animation:pulse 2s infinite}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes popIn{from{transform:translateX(-50%) scale(.9);opacity:0}to{transform:translateX(-50%) scale(1);opacity:1}}
        @keyframes slideUp{from{transform:translateY(30px);opacity:0}to{transform:translateY(0);opacity:1}}
        .page{animation:slideUp .3s ease}
        .photo-upload{border:2px dashed #2a2d3e;border-radius:14px;padding:20px;text-align:center;cursor:pointer;transition:border .2s}
        .photo-upload:hover{border-color:#6ee7b7}
        .product-photo{width:100%;height:140px;object-fit:cover;border-radius:12px}
      `}</style>

      {/* HEADER */}
      <div style={{ background:"#0c0e17ee",backdropFilter:"blur(20px)",padding:"14px 20px 12px",borderBottom:"1px solid #1a1d2e",position:"sticky",top:0,zIndex:50,display:"flex",alignItems:"center",justifyContent:"space-between" }}>
        <div>
          <div style={{ fontSize:10,color:"#3a3f5c",fontWeight:800,letterSpacing:2,textTransform:"uppercase" }}>Торговый представитель</div>
          <div style={{ fontSize:19,fontWeight:900,letterSpacing:-.5 }}>3емабек Опт<span style={{ color:"#6ee7b7" }}> Pro</span></div>
        </div>
        <div style={{ display:"flex",gap:12,alignItems:"center" }}>
          <div style={{ position:"relative",cursor:"pointer" }} onClick={() => setTab("notifications")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={unread>0?"#f59e0b":"#3a3f5c"} strokeWidth="2.2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            {unread > 0 && <span style={{ position:"absolute",top:-5,right:-5,background:"#ef4444",color:"#fff",fontSize:9,fontWeight:900,borderRadius:10,padding:"1px 4px",minWidth:15,textAlign:"center",lineHeight:"13px" }}>{unread}</span>}
          </div>
          <div style={{ width:36,height:36,borderRadius:12,background:"linear-gradient(135deg,#6ee7b7 0%,#3b82f6 100%)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:13,color:"#0c0e17" }}>СМ</div>
        </div>
      </div>

      {/* PAGE CONTENT */}
      <div style={{ padding:"16px 14px 90px",maxWidth:480,margin:"0 auto" }}>

        {/* ── DASHBOARD ── */}
        {tab === "dashboard" && (
          <div className="page">
            <div style={{ marginBottom:18 }}>
              <div style={{ fontSize:12,color:"#4a5177" }}>Добрый день,</div>
              <div style={{ fontSize:24,fontWeight:900,letterSpacing:-.5 }}>Сауле Махметова 👋</div>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14 }}>
              {[
                { l:"Магазины",  v:stores.length,                                ic:"🏪", c:"#6ee7b7" },
                { l:"Мало остат.", v:lowStock.length,                             ic:"⚠️", c:"#f59e0b" },
                { l:"В ожидании", v:orders.filter(o=>o.status==="pending").length, ic:"📦", c:"#3b82f6" },
              ].map((s,i) => (
                <div key={i} className="card" style={{ textAlign:"center",padding:"12px 6px" }}>
                  <div style={{ fontSize:20 }}>{s.ic}</div>
                  <div style={{ fontSize:24,fontWeight:900,color:s.c,lineHeight:1 }}>{s.v}</div>
                  <div style={{ fontSize:10,color:"#4a5177",fontWeight:700,marginTop:2 }}>{s.l}</div>
                </div>
              ))}
            </div>

            {lowStock.length > 0 && (
              <div className="card" style={{ borderColor:"#f59e0b33",marginBottom:14 }}>
                <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}>
                  <span style={{ fontSize:14 }}>⚠️</span>
                  <span style={{ fontWeight:800,color:"#f59e0b",fontSize:13 }}>Заканчивается товар</span>
                  <span className="tag" style={{ background:"#f59e0b22",color:"#f59e0b",marginLeft:"auto" }}>{lowStock.length}</span>
                </div>
                {lowStock.slice(0,3).map(p => (
                  <div key={p.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid #1e2133" }}>
                    {p.photoUrl
                      ? <img src={p.photoUrl} alt={p.name} style={{ width:38,height:38,borderRadius:10,objectFit:"cover",flexShrink:0 }}/>
                      : <PhotoPlaceholder category={p.category} size={38}/>
                    }
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13,fontWeight:700 }}>{p.name}</div>
                      <div style={{ fontSize:11,color:"#4a5177" }}>{p.unit}</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:18,fontWeight:900,color:"#ef4444" }}>{p.stock}</div>
                      <div style={{ fontSize:10,color:"#4a5177" }}>мин. {p.minStock}</div>
                    </div>
                  </div>
                ))}
                <button className="btn btn-green btn-sm" style={{ width:"100%",marginTop:10 }} onClick={() => setTab("orders")}>Создать заказ →</button>
              </div>
            )}

            <div style={{ fontWeight:800,fontSize:14,marginBottom:10 }}>Последние заказы</div>
            {orders.slice(0,3).map(o => (
              <div key={o.id} className="card" style={{ display:"flex",alignItems:"center",gap:12,cursor:"pointer" }} onClick={() => setOrderModal(o)}>
                <div style={{ width:42,height:42,borderRadius:12,background:`${STATUS_COLOR[o.status]}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0 }}>📦</div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontSize:13,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{o.storeName}</div>
                  <div style={{ fontSize:11,color:"#4a5177" }}>{o.items.length} поз. · {new Date(o.createdAt).toLocaleDateString("ru")}</div>
                </div>
                <div style={{ textAlign:"right",flexShrink:0 }}>
                  <div style={{ fontSize:13,fontWeight:800,color:"#6ee7b7" }}>{o.total.toLocaleString()}₸</div>
                  <span className="tag" style={{ background:`${STATUS_COLOR[o.status]}22`,color:STATUS_COLOR[o.status],fontSize:10 }}>{STATUS_LABEL[o.status]}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── INVENTORY ── */}
        {tab === "inventory" && (
          <div className="page">
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16 }}>
              <div style={{ fontSize:20,fontWeight:900 }}>Каталог товаров</div>
              <button className="btn btn-green btn-sm" onClick={openAddModal}>+ Добавить</button>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
              {products.map(p => {
                const low = p.stock <= p.minStock;
                return (
                  <div key={p.id} className="card" style={{ padding:0,overflow:"hidden",borderColor:low?"#f59e0b33":"#1e2133",cursor:"pointer" }} onClick={() => openEditModal(p)}>
                    {/* Photo area */}
                    <div style={{ position:"relative",height:100,background:"#1a1d2e",overflow:"hidden" }}>
                      {p.photoUrl
                        ? <img src={p.photoUrl} alt={p.name} style={{ width:"100%",height:"100%",objectFit:"cover" }}/>
                        : <div style={{ width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:36 }}>{CATEGORY_EMOJI[p.category]||"📦"}</div>
                      }
                      {low && <div className="pulse" style={{ position:"absolute",top:8,right:8,background:"#ef4444",borderRadius:8,padding:"2px 7px",fontSize:10,fontWeight:900,color:"#fff" }}>МАЛО</div>}
                    </div>
                    {/* Info */}
                    <div style={{ padding:"10px 12px 12px" }}>
                      <div style={{ fontSize:12,fontWeight:800,marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{p.name}</div>
                      <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:8 }}>
                        <StockBar stock={p.stock} minStock={p.minStock}/>
                        <span style={{ fontSize:13,fontWeight:900,color:low?"#ef4444":"#6ee7b7",flexShrink:0 }}>{p.stock}</span>
                      </div>
                      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                        <span style={{ fontSize:11,color:"#4a5177",fontWeight:700 }}>{p.price}₸</span>
                        <div style={{ display:"flex",gap:4 }} onClick={e=>e.stopPropagation()}>
                          <button style={{ background:"#1e2133",border:"none",color:"#e2e8f0",borderRadius:8,width:24,height:24,cursor:"pointer",fontWeight:900,fontSize:13 }} onClick={()=>updateStock(p.id,p.stock-1)}>−</button>
                          <button style={{ background:"#6ee7b722",border:"none",color:"#6ee7b7",borderRadius:8,width:24,height:24,cursor:"pointer",fontWeight:900,fontSize:13 }} onClick={()=>updateStock(p.id,p.stock+1)}>+</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── NEW ORDER ── */}
        {tab === "orders" && (
          <div className="page">
            <div style={{ fontSize:20,fontWeight:900,marginBottom:4 }}>Новый заказ</div>
            <div style={{ fontSize:12,color:"#4a5177",marginBottom:14 }}>Выберите магазин и товары</div>
            <div className="card" style={{ marginBottom:14 }}>
              <div style={{ fontSize:11,fontWeight:800,color:"#4a5177",marginBottom:8,letterSpacing:.5 }}>МАГАЗИН</div>
              {selectedStore && (
                <select className="input" value={selectedStore.id} onChange={e => setSelectedStore(stores.find(s=>s.id===e.target.value))}>
                  {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
              {selectedStore && <div style={{ fontSize:11,color:"#4a5177",marginTop:6 }}>📍 {selectedStore.address} · 👤 {selectedStore.manager}</div>}
            </div>
            <div style={{ fontSize:11,fontWeight:800,color:"#4a5177",marginBottom:8,letterSpacing:.5 }}>ТОВАРЫ</div>
            {products.map(p => {
              const qty = cart[p.id] || 0;
              const low = p.stock <= p.minStock;
              return (
                <div key={p.id} className="card" style={{ display:"flex",alignItems:"center",gap:10,borderColor:low?"#f59e0b22":"#1e2133" }}>
                  {p.photoUrl
                    ? <img src={p.photoUrl} alt={p.name} style={{ width:44,height:44,borderRadius:10,objectFit:"cover",flexShrink:0 }}/>
                    : <PhotoPlaceholder category={p.category} size={44}/>
                  }
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:13,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{p.name} {low&&<span style={{fontSize:10,color:"#f59e0b"}}>⚠</span>}</div>
                    <div style={{ fontSize:11,color:"#4a5177" }}>{p.price}₸ · ост. {p.stock}</div>
                  </div>
                  <div style={{ display:"flex",alignItems:"center",gap:6,flexShrink:0 }}>
                    {qty > 0 && <>
                      <button style={{ background:"#1e2133",border:"none",color:"#e2e8f0",borderRadius:8,width:28,height:28,cursor:"pointer",fontWeight:900 }} onClick={() => setCart(c=>{ const n={...c}; n[p.id]<=1?delete n[p.id]:n[p.id]--; return n; })}>−</button>
                      <span style={{ fontWeight:900,fontSize:14,minWidth:20,textAlign:"center",color:"#6ee7b7" }}>{qty}</span>
                    </>}
                    <button style={{ background:qty>0?"#6ee7b722":"#1e2133",border:"none",color:qty>0?"#6ee7b7":"#94a3b8",borderRadius:8,width:28,height:28,cursor:"pointer",fontWeight:900 }} onClick={() => setCart(c=>({...c,[p.id]:(c[p.id]||0)+1}))}>+</button>
                  </div>
                </div>
              );
            })}
            {cartCount > 0 && (
              <div style={{ position:"sticky",bottom:86,background:"#13162099",backdropFilter:"blur(20px)",border:"1px solid #6ee7b733",borderRadius:16,padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:6 }}>
                <div>
                  <div style={{ fontSize:11,color:"#4a5177",fontWeight:700 }}>{cartCount} позиций в заказе</div>
                  <div style={{ fontSize:20,fontWeight:900,color:"#6ee7b7" }}>{cartTotal.toLocaleString()}₸</div>
                </div>
                <button className="btn btn-green" onClick={placeOrder}>Оформить →</button>
              </div>
            )}
          </div>
        )}

        {/* ── HISTORY ── */}
        {tab === "history" && (
          <div className="page">
            <div style={{ fontSize:20,fontWeight:900,marginBottom:16 }}>История заказов</div>
            {orders.map(o => (
              <div key={o.id} className="card" style={{ cursor:"pointer" }} onClick={() => setOrderModal(o)}>
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6 }}>
                  <div style={{ fontSize:13,fontWeight:800 }}>{o.storeName}</div>
                  <span className="tag" style={{ background:`${STATUS_COLOR[o.status]}22`,color:STATUS_COLOR[o.status] }}>{STATUS_LABEL[o.status]}</span>
                </div>
                <div style={{ fontSize:11,color:"#4a5177",marginBottom:8 }}>{new Date(o.createdAt).toLocaleDateString("ru")} · {o.items.length} позиций</div>
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                  <div style={{ fontSize:11,color:"#6b7280",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"60%" }}>{o.items.map(i=>`${i.name} ×${i.qty}`).join(", ")}</div>
                  <div style={{ fontSize:15,fontWeight:900,color:"#6ee7b7" }}>{o.total.toLocaleString()}₸</div>
                </div>
                {o.status === "pending" && (
                  <div style={{ display:"flex",gap:8,marginTop:10 }} onClick={e=>e.stopPropagation()}>
                    <button className="btn btn-green btn-sm" style={{ flex:1 }} onClick={()=>changeStatus(o.id,"confirmed")}>✓ Подтвердить</button>
                    <button className="btn btn-sm" style={{ flex:1,background:"#10b98122",color:"#10b981" }} onClick={()=>changeStatus(o.id,"delivered")}>🚚 Доставлен</button>
                  </div>
                )}
                {o.status === "confirmed" && (
                  <button className="btn btn-sm" style={{ width:"100%",marginTop:10,background:"#10b98122",color:"#10b981" }} onClick={e=>{e.stopPropagation();changeStatus(o.id,"delivered");}}>🚚 Отметить доставленным</button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── NOTIFICATIONS ── */}
        {tab === "notifications" && (
          <div className="page">
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16 }}>
              <div style={{ fontSize:20,fontWeight:900 }}>Уведомления</div>
              {unread > 0 && <button style={{ background:"none",border:"none",color:"#6ee7b7",fontWeight:800,fontSize:12,cursor:"pointer" }} onClick={markAllRead}>Прочитать все</button>}
            </div>
            {notifications.map(n => (
              <div key={n.id} className="card" style={{ borderColor:n.read?"#1e2133":"#f59e0b44",background:n.read?"":"#f59e0b06",cursor:"pointer" }}
                onClick={async()=>{ await api.patch(`/notifications/${n.id}/read`,{}); setNotifications(p=>p.map(x=>x.id===n.id?{...x,read:true}:x)); }}>
                <div style={{ display:"flex",gap:12,alignItems:"flex-start" }}>
                  <div style={{ fontSize:24,flexShrink:0 }}>⚠️</div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:4 }}>
                      <span style={{ fontSize:13,fontWeight:800 }}>{n.storeName}</span>
                      {!n.read && <span style={{ width:7,height:7,borderRadius:"50%",background:"#ef4444",display:"inline-block" }}/>}
                    </div>
                    <div style={{ fontSize:12,color:"#cbd5e1",marginBottom:4 }}>
                      Заканчивается <b>{n.productName}</b>: <span style={{ color:"#ef4444",fontWeight:900 }}>{n.stock} шт.</span> (мин. {n.minStock})
                    </div>
                    <div style={{ fontSize:10,color:"#4a5177" }}>{new Date(n.createdAt).toLocaleString("ru")}</div>
                  </div>
                </div>
                <button className="btn btn-green btn-sm" style={{ width:"100%",marginTop:10 }} onClick={e=>{e.stopPropagation();setTab("orders");}}>Создать заказ →</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── BOTTOM NAV ── */}
      <div style={{ position:"fixed",bottom:0,left:0,right:0,background:"#0c0e17ee",backdropFilter:"blur(20px)",borderTop:"1px solid #1a1d2e",display:"flex",justifyContent:"space-around",padding:"6px 0 10px",zIndex:50 }}>
        {[
          { id:"dashboard", l:"Главная",  ico:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg> },
          { id:"inventory", l:"Товары",   ico:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg> },
          { id:"orders",    l:"Заказ",    ico:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg> },
          { id:"history",   l:"История",  ico:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> },
          { id:"notifications", l:"Сигналы", badge:unread, ico:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> },
        ].map(t => (
          <button key={t.id} className={`nav-btn ${tab===t.id?"active":""}`} onClick={()=>setTab(t.id)}>
            {t.ico}
            {t.badge>0&&<span style={{ position:"absolute",top:4,right:6,background:"#ef4444",color:"#fff",fontSize:8,fontWeight:900,borderRadius:8,padding:"1px 4px",lineHeight:"12px" }}>{t.badge}</span>}
            {t.l}
          </button>
        ))}
      </div>

      {/* ── PRODUCT MODAL (ADD / EDIT) ── */}
      {productModal && (
        <div className="modal-bg" onClick={()=>setProductModal(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{ animation:"slideUp .3s ease" }}>
            <div style={{ fontSize:16,fontWeight:900,marginBottom:16 }}>
              {productModal==="add" ? "Добавить товар" : `Редактировать: ${productModal.name}`}
            </div>

            {/* Photo upload */}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11,fontWeight:800,color:"#4a5177",marginBottom:8,letterSpacing:.5 }}>ФОТО ТОВАРА</div>
              {photoPreview ? (
                <div style={{ position:"relative",borderRadius:14,overflow:"hidden" }}>
                  <img src={photoPreview} alt="preview" className="product-photo"/>
                  <div style={{ position:"absolute",top:8,right:8,display:"flex",gap:6 }}>
                    <button onClick={()=>photoInputRef.current.click()}
                      style={{ background:"rgba(0,0,0,.7)",border:"none",color:"#fff",borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer" }}>
                      Изменить
                    </button>
                    <button onClick={()=>{ setPhotoPreview(null); setForm(f=>({...f,photo:null})); if(productModal!=="add") deletePhoto(productModal.id); }}
                      style={{ background:"rgba(239,68,68,.8)",border:"none",color:"#fff",borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer" }}>
                      ✕
                    </button>
                  </div>
                </div>
              ) : (
                <div className="photo-upload" onClick={()=>photoInputRef.current.click()}>
                  <div style={{ fontSize:32,marginBottom:8 }}>📷</div>
                  <div style={{ fontSize:13,fontWeight:700,color:"#4a5177" }}>Нажмите чтобы добавить фото</div>
                  <div style={{ fontSize:11,color:"#3a3f5c",marginTop:4 }}>JPG, PNG, WEBP · до 5 МБ</div>
                </div>
              )}
              <input ref={photoInputRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handlePhotoChange}/>
            </div>

            {/* Fields */}
            {[
              { key:"name",     label:"Название *",     placeholder:"Сахар белый" },
              { key:"unit",     label:"Единица",         placeholder:"пачка (1кг)" },
              { key:"category", label:"Категория",       placeholder:"Бакалея", type:"select" },
              { key:"price",    label:"Цена (₸)",        placeholder:"89",      type:"number" },
              { key:"stock",    label:"Остаток *",       placeholder:"10",      type:"number" },
              { key:"minStock", label:"Мин. остаток",    placeholder:"5",       type:"number" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom:10 }}>
                <div style={{ fontSize:11,fontWeight:800,color:"#4a5177",marginBottom:5,letterSpacing:.5 }}>{f.label.toUpperCase()}</div>
                {f.type === "select"
                  ? <select className="input" value={form[f.key]} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}>
                      {["Бакалея","Масла","Напитки","Приправы","Другое"].map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                  : <input className="input" type={f.type||"text"} placeholder={f.placeholder} value={form[f.key]} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}/>
                }
              </div>
            ))}

            <div style={{ display:"flex",gap:10,marginTop:6 }}>
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={()=>setProductModal(null)}>Отмена</button>
              <button className="btn btn-green" style={{ flex:1 }} onClick={saveProduct}>
                {productModal==="add" ? "Добавить" : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ORDER DETAIL MODAL ── */}
      {orderModal && (
        <div className="modal-bg" onClick={()=>setOrderModal(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{ animation:"slideUp .3s ease" }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14 }}>
              <div style={{ fontSize:16,fontWeight:900 }}>Заказ #{orderModal.id.slice(0,8)}</div>
              <span className="tag" style={{ background:`${STATUS_COLOR[orderModal.status]}22`,color:STATUS_COLOR[orderModal.status] }}>{STATUS_LABEL[orderModal.status]}</span>
            </div>
            <div style={{ fontSize:12,color:"#4a5177",marginBottom:12 }}>📍 {orderModal.storeName} · {new Date(orderModal.createdAt).toLocaleDateString("ru")}</div>
            {orderModal.items.map((item,i) => {
              const p = products.find(p=>p.id===item.productId);
              return (
                <div key={i} style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid #1e2133" }}>
                  {p?.photoUrl ? <img src={p.photoUrl} alt={item.name} style={{ width:34,height:34,borderRadius:8,objectFit:"cover",flexShrink:0 }}/> : <PhotoPlaceholder category={p?.category} size={34}/>}
                  <span style={{ fontSize:13,flex:1 }}>{item.name}</span>
                  <span style={{ fontSize:13,fontWeight:800,color:"#6ee7b7" }}>×{item.qty}</span>
                  <span style={{ fontSize:12,color:"#4a5177" }}>{(item.price*item.qty).toLocaleString()}₸</span>
                </div>
              );
            })}
            <div style={{ display:"flex",justifyContent:"space-between",padding:"12px 0" }}>
              <span style={{ fontWeight:800 }}>Итого</span>
              <span style={{ fontSize:20,fontWeight:900,color:"#6ee7b7" }}>{orderModal.total.toLocaleString()}₸</span>
            </div>
            <button className="btn btn-ghost" style={{ width:"100%" }} onClick={()=>setOrderModal(null)}>Закрыть</button>
          </div>
        </div>
      )}

      <Toast toast={toast}/>
    </div>
  );
}
