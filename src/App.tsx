import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageCircle, 
  Code, 
  Megaphone, 
  Phone, 
  Mail, 
  ArrowUp, 
  ArrowDown, 
  LogOut, 
  Plus,
  Settings,
  X,
  Globe,
  Smartphone,
  Save,
  Loader2,
  Zap,
  DollarSign,
  Clock,
  ShieldCheck,
  Cpu,
  Network,
  Database,
  Wifi,
  Layers,
  Share2
} from 'lucide-react';
import { 
  onSnapshot, 
  doc, 
  setDoc, 
  getDocFromServer,
  getFirestore
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider,
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { GoogleGenAI } from "@google/genai";
import { db, auth } from './firebase';

// --- Types ---
type SectionId = 'hero' | 'services' | 'why-us' | 'clients' | 'contact';

interface Section {
  id: SectionId;
  title: string;
}

interface Client {
  id: string;
  name: string;
  imageUrl?: string;
}

interface WebsiteConfig {
  logoText: string;
  logoUrl?: string;
  heroTitle: string;
  heroDesc: string;
  sections: Section[];
  clients: Client[];
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

// --- Helper Functions ---
function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Main Component ---
export default function App() {
  // --- State ---
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [config, setConfig] = useState<WebsiteConfig>({
    logoText: 'iDesigner',
    logoUrl: '',
    heroTitle: 'Your Technology Partner',
    heroDesc: 'حلول تكنولوجية للأنشطة التجارية',
    sections: [
      { id: 'hero', title: 'قسم الهيرو' },
      { id: 'services', title: 'قسم الخدمات' },
      { id: 'why-us', title: 'لماذا iDesigner؟' },
      { id: 'clients', title: 'قسم العملاء' },
      { id: 'contact', title: 'قسم اتصل بنا' },
    ],
    clients: [
      { id: '1', name: 'LOGO 1', imageUrl: '' },
      { id: '2', name: 'LOGO 2', imageUrl: '' },
    ],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientUrl, setNewClientUrl] = useState('');

  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [expandedService, setExpandedService] = useState<string | null>(null);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);

  const generateHeroImage = async () => {
    setIsGeneratingImage(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `A wide-angle, hyper-realistic, 3D render of a futuristic Google Cloud environment. The scene is a minimalist, white architectural space. Centered is a clean, glass desk supporting a holographic laptop screen displaying a colorful, intricate cloud data flow visualization. Abstract isometric shapes, glowing interconnecting lines, and stylized 3D data nodes float gracefully, creating a sense of a vast, ethereal digital network. The entire composition utilizes a clean, corporate Google color palette (vibrant blues, soft teals, subtle reds, and yellow accents). Diffuse, soft, cinematic lighting emanates from the holographic elements and architectural panels, providing a warm but professional glow. Highly detailed texture, 8k resolution, photorealistic, elegant, and efficient tech corporate aesthetic, suitable for a professional website hero image, depth of field effect.`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: prompt }],
        },
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const base64Data = part.inlineData.data;
          setHeroImageUrl(`data:image/png;base64,${base64Data}`);
          break;
        }
      }
    } catch (error) {
      console.error("Error generating hero image:", error);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  useEffect(() => {
    if (!heroImageUrl && config.heroTitle) {
      generateHeroImage();
    }
  }, []);

  useEffect(() => {
    // Expose handleLogin to window for hidden access since the UI section was removed
    (window as any).login = handleLogin;
    return () => {
      delete (window as any).login;
    };
  }, []);

  // --- Firebase Listeners ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthReady(true);
    });

    const unsubscribeConfig = onSnapshot(doc(db, 'settings', 'config'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as WebsiteConfig;
        // Ensure 'why-us' section exists in the sections list if it's a new feature
        if (data.sections && !data.sections.find(s => s.id === 'why-us')) {
          const heroIndex = data.sections.findIndex(s => s.id === 'hero');
          const newSections = [...data.sections];
          newSections.splice(heroIndex + 2, 0, { id: 'why-us', title: 'لماذا iDesigner؟' });
          data.sections = newSections;
        }
        setConfig(data);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/config');
    });

    // Test connection
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();

    return () => {
      unsubscribeAuth();
      unsubscribeConfig();
    };
  }, []);

  // --- Handlers ---
  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setShowAdminPanel(true);
    } catch (error) {
      alert('فشل تسجيل الدخول. يرجى المحاولة باستخدام حساب جوجل المعتمد.');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setShowAdminPanel(false);
  };

  const saveConfig = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'config'), config);
      alert('تم حفظ التغييرات بنجاح');
      setShowAdminPanel(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/config');
    } finally {
      setIsSaving(false);
    }
  };

  const updateLocalConfig = (updates: Partial<WebsiteConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const openWhatsApp = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setShowWhatsAppModal(true);
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    const newSections = [...config.sections];
    if (direction === 'up' && index > 0) {
      [newSections[index], newSections[index - 1]] = [newSections[index - 1], newSections[index]];
    } else if (direction === 'down' && index < newSections.length - 1) {
      [newSections[index], newSections[index + 1]] = [newSections[index + 1], newSections[index]];
    }
    updateLocalConfig({ sections: newSections });
  };

  const addClient = () => {
    if (newClientName.trim()) {
      updateLocalConfig({ 
        clients: [...config.clients, { 
          id: Date.now().toString(), 
          name: newClientName,
          imageUrl: newClientUrl.trim()
        }] 
      });
      setNewClientName('');
      setNewClientUrl('');
    }
  };

  const removeClient = (id: string) => {
    updateLocalConfig({ 
      clients: config.clients.filter(c => c.id !== id) 
    });
  };

  // --- Render Sections ---
  const TechBackground = ({ opacity = 0.1, count = 8, icons = [<Code />, <Cpu />, <Smartphone />, <Globe />], iconClass = "text-secondary-blue" }: { opacity?: number, count?: number, icons?: React.ReactNode[], iconClass?: string }) => (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ opacity }}>
      {[...Array(count)].map((_, i) => (
        <motion.div
          key={i}
          animate={{
            y: [0, -60, 0],
            x: [0, 40, 0],
            rotate: [0, 360],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 12 + i * 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className={`absolute ${iconClass}`}
          style={{
            top: `${(i * 100) / count}%`,
            left: `${(i * 137) % 100}%`, // More deterministic but varied distribution
          }}
        >
          {icons[i % icons.length]}
        </motion.div>
      ))}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:50px_50px]"></div>
    </div>
  );

  const renderSection = (sectionId: SectionId) => {
    switch (sectionId) {
      case 'hero':
        return (
          <section key="hero" id="heroSection" className="py-16 md:py-32 px-6 md:px-[10%] text-center bg-[radial-gradient(circle,_#001a33_0%,_#000E1A_100%)] relative overflow-hidden min-h-[600px] flex flex-col justify-center">
            {heroImageUrl ? (
              <div className="absolute inset-0 z-0">
                <img 
                  src={heroImageUrl} 
                  alt="Futuristic Tech Background" 
                  className="w-full h-full object-cover opacity-30"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-primary-dark/80 via-transparent to-primary-dark/80"></div>
              </div>
            ) : (
              <TechBackground opacity={0.2} count={10} iconClass="text-white" icons={[<Code size={48}/>, <Cpu size={48}/>, <Network size={48}/>, <Database size={48}/>]} />
            )}
            
            {isGeneratingImage && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-primary-dark/40 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="w-10 h-10 text-secondary-blue animate-spin" />
                  <p className="text-white font-medium animate-pulse">جاري إنشاء الخلفية المستقبلية...</p>
                </div>
              </div>
            )}

            <div className="relative z-10">
              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                className="text-4xl md:text-7xl font-bold mb-6 leading-tight"
              >
                {config.heroTitle}
              </motion.h1>
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-gray-400 max-w-3xl mx-auto text-base md:text-lg mb-10"
              >
                {config.heroDesc}
              </motion.p>
              <button 
                onClick={() => openWhatsApp()}
                className="btn-green text-lg px-8 py-4"
              >
                ابدأ الآن
              </button>
            </div>
          </section>
        );
      case 'services':
        const servicesData = [
          {
            id: 's1',
            icon: <Megaphone className="w-10 h-10 md:w-12 md:h-12 text-secondary-blue mb-4" />,
            title: 'صناعة المحتوى و إدارة التواصل الإجتماعي',
            subtitle: 'Content Creation & Social Media Management',
            definition: 'هي عملية بناء الحضور الرقمي للعلامة التجارية من خلال تصاميم بصرية وفيديوهات تفاعلية وإدارة استراتيجية للمنصات.',
            explanation: 'تشمل تصميم الجرافيك الإبداعي، المونتاج السينمائي للفيديوهات، الموشن جرافيك الذي يشرح الفكر، وإدارة الحسابات لضمان التفاعل المستمر.',
            benefits: [
              { label: 'بناء الهوية', text: 'تعزيز صورة علامتك التجارية ككيان محترف وموثوق.' },
              { label: 'الانتشار', text: 'الوصول لجمهور أكبر في عُمان وخارجها من خلال محتوى "ترند" وجذاب.' },
              { label: 'توفير الوقت', text: 'التفرغ لإدارة عملك وترك مهمة الإبداع والتواصل لفريقنا المتخصص.' }
            ]
          },
          {
            id: 's2',
            icon: <Globe className="w-10 h-10 md:w-12 md:h-12 text-secondary-blue mb-4" />,
            title: 'تطوير المواقع و المتاجر الإليكترونية',
            subtitle: 'Web & E-commerce Development',
            definition: 'تصميم وبرمجة واجهات رقمية (مواقع تعريفية أو متاجر بيع) تتميز بالسرعة وسهولة الاستخدام.',
            explanation: 'نقوم ببناء مواقع متوافقة مع الجوال، ومتاجر إلكترونية متكاملة مع بوابات الدفع والشحن، مع التركيز على تجربة المستخدم (UX).',
            benefits: [
              { label: 'التواجد 24/7', text: 'موقعك هو موظف مبيعات لا ينام، يعرض خدماتك طوال اليوم.' },
              { label: 'زيادة المبيعات', text: 'تحويل الزيارات لعمليات شراء فعلية بفضل سلاسة التصميم وثقة العميل في المتجر.' },
              { label: 'الاحترافية', text: 'الموقع الإلكتروني هو "المقر الرسمي" لنشاطك التجاري على الإنترنت.' }
            ]
          },
          {
            id: 's3',
            icon: <Smartphone className="w-10 h-10 md:w-12 md:h-12 text-secondary-blue mb-4" />,
            title: 'التطبيقات والأنظمة الذكية (ERP / CRM)',
            subtitle: 'Smart Apps & Enterprise Systems',
            definition: 'حلول برمجية متطورة (تطبيقات جوال أو أنظمة ويب) تهدف لأتمتة وتنظيم العمليات الداخلية والخارجية للشركة.',
            explanation: 'تشمل تطوير تطبيقات iOS و Android، بالإضافة لبرامج إدارة الموارد (ERP) وإدارة علاقات العملاء (CRM) التي تربط الأقسام ببعضها.',
            benefits: [
              { label: 'الكفاءة التشغيلية', text: 'تقليل الأخطاء البشرية وسرعة إنجاز المهام داخل المؤسسة.' },
              { label: 'دقة البيانات', text: 'الحصول على تقارير فورية دقيقة تساعدك في اتخاذ قرارات تجارية صحيحة.' },
              { label: 'الولاء', text: 'تطبيقات الجوال تبقيك دائماً في "جيب العميل"، مما يزيد من ولائه لعلامتك التجارية.' }
            ]
          }
        ];

        return (
          <section key="services" id="servicesSection" className="py-16 md:py-24 px-6 md:px-[10%] bg-white text-primary-dark relative overflow-hidden">
            <TechBackground opacity={0.08} count={8} icons={[<Layers size={35}/>, <Wifi size={35}/>, <Share2 size={35}/>]} />
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">خدماتنا المتميزة</h2>
              
              {/* Mobile: Horizontal Scroll | Desktop: 3-Column Grid */}
              <div className="flex md:grid md:grid-cols-3 gap-6 overflow-x-auto md:overflow-visible pb-6 md:pb-0 snap-x snap-mandatory no-scrollbar">
                {servicesData.map((service) => (
                  <motion.div 
                    key={service.id}
                    layout
                    className="min-w-[85%] md:min-w-0 snap-center border border-gray-200 rounded-2xl shadow-sm overflow-hidden bg-white flex flex-col h-fit"
                  >
                    <button 
                      onClick={() => setExpandedService(expandedService === service.id ? null : service.id)}
                      className="w-full p-6 md:p-8 flex flex-col items-center text-center gap-4 hover:bg-gray-50 transition-colors flex-grow"
                    >
                      <div className="shrink-0 scale-90 md:scale-100">{service.icon}</div>
                      <div className="flex-grow">
                        <h3 className="text-lg md:text-xl font-bold mb-1 leading-tight">{service.title}</h3>
                        <p className="text-secondary-blue font-medium text-xs md:text-sm mb-2">{service.subtitle}</p>
                        <p className="text-gray-600 text-xs md:text-sm line-clamp-3">{service.definition}</p>
                      </div>
                      <div className={`transition-transform duration-300 ${expandedService === service.id ? 'rotate-180' : ''}`}>
                        <ArrowDown className="text-gray-400" size={20} />
                      </div>
                    </button>

                    <AnimatePresence>
                      {expandedService === service.id && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <div className="p-5 md:p-6 pt-0 border-t border-gray-100 bg-gray-50/50">
                            <div className="space-y-4 text-right">
                              <div>
                                <h4 className="font-bold text-secondary-blue text-xs md:text-sm mb-1">التعريف:</h4>
                                <p className="text-gray-700 text-xs md:text-sm leading-relaxed">{service.definition}</p>
                              </div>
                              <div>
                                <h4 className="font-bold text-secondary-blue text-xs md:text-sm mb-1">الشرح:</h4>
                                <p className="text-gray-700 text-xs md:text-sm leading-relaxed">{service.explanation}</p>
                              </div>
                              <div>
                                <h4 className="font-bold text-secondary-blue text-xs md:text-sm mb-2">الفائدة:</h4>
                                <div className="space-y-2">
                                  {service.benefits.map((benefit, bIdx) => (
                                    <div key={bIdx} className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                                      <span className="font-bold text-primary-dark block text-xs mb-0.5">{benefit.label}:</span>
                                      <span className="text-gray-600 text-[11px] md:text-xs leading-relaxed">{benefit.text}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="pt-2">
                                <button 
                                  onClick={() => openWhatsApp()}
                                  className="btn-green w-full justify-center py-2 text-xs"
                                >
                                  <MessageCircle size={16} />
                                  اطلب الخدمة
                                </button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        );
      case 'why-us':
        return (
          <section key="why-us" id="whyUsSection" className="py-16 md:py-24 px-6 md:px-[10%] bg-primary-dark relative overflow-hidden">
            <TechBackground opacity={0.2} count={9} iconClass="text-white" icons={[<Zap size={40}/>, <ShieldCheck size={40}/>, <Cpu size={40}/>]} />
            <div className="relative z-10">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-5xl font-bold mb-4">لماذا iDesigner؟</h2>
                <p className="text-secondary-blue font-medium text-lg md:text-xl">(خلاصة الفوائد للشركات)</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                  {
                    icon: <Zap className="w-12 h-12 text-secondary-blue mb-6" />,
                    title: "مرونة الفريلانس",
                    subtitle: "Freelance Agility",
                    desc: "سرعة استجابة وتواصل مباشر بدون تعقيدات الشركات الكبرى."
                  },
                  {
                    icon: <DollarSign className="w-12 h-12 text-secondary-blue mb-6" />,
                    title: "ذكاء التكلفة",
                    subtitle: "Smart Cost",
                    desc: "الحصول على جودة 'الوكالات العالمية' بأسعار تنافسية تناسب ميزانية الشركات العمانية."
                  },
                  {
                    icon: <Clock className="w-12 h-12 text-secondary-blue mb-6" />,
                    title: "دعم مستمر",
                    subtitle: "24/7 Support",
                    desc: "نحن معك لحظة بلحظة، نضمن أن تكنولوجيتك تعمل دائماً بكفاءة 100%."
                  }
                ].map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.2 }}
                    className="bg-[#001a33]/50 backdrop-blur-sm p-8 rounded-3xl border border-secondary-blue/20 hover:border-secondary-blue/50 transition-all group"
                  >
                    <div className="bg-secondary-blue/10 w-20 h-20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      {item.icon}
                    </div>
                    <h3 className="text-2xl font-bold mb-1">{item.title}</h3>
                    <p className="text-secondary-blue text-sm font-medium mb-4">{item.subtitle}</p>
                    <p className="text-gray-400 leading-relaxed">{item.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        );
      case 'clients':
        return (
          <section key="clients" id="clientsSection" className="py-16 md:py-24 bg-primary-dark overflow-hidden relative">
            <TechBackground opacity={0.15} count={7} iconClass="text-white" icons={[<Globe size={35}/>, <Network size={35}/>, <Layers size={35}/>]} />
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">شركاء النجاح</h2>
              <div className="relative flex overflow-x-hidden">
              <motion.div 
                animate={{ x: ["0%", "-50%"] }}
                transition={{ 
                  duration: 20, 
                  repeat: Infinity, 
                  ease: "linear" 
                }}
                className="flex gap-4 md:gap-8 whitespace-nowrap"
              >
                {/* Double the items for seamless loop */}
                {[...config.clients, ...config.clients].map((client, idx) => (
                  <motion.div 
                    key={`${client.id}-${idx}`}
                    className="w-36 h-20 md:w-48 md:h-24 bg-gray-100 flex items-center justify-center rounded-xl text-gray-500 font-bold text-base md:text-lg relative group shrink-0 overflow-hidden"
                  >
                    {client.imageUrl ? (
                      <img 
                        src={client.imageUrl} 
                        alt={client.name} 
                        className="w-full h-full object-contain p-3 md:p-4"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      client.name
                    )}
                    {user && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          removeClient(client.id);
                        }}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      >
                        <X size={10} />
                      </button>
                    )}
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>
        </section>
      );
      case 'contact':
        return (
          <section key="contact" id="contactSection" className="py-16 md:py-24 px-6 md:px-[10%] bg-[#001529] text-center relative overflow-hidden">
            <TechBackground opacity={0.15} count={8} iconClass="text-white" icons={[<Phone size={35}/>, <Mail size={35}/>, <Network size={35}/>]} />
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">اتصل بنا</h2>
              <p className="text-gray-400 mb-12 text-sm md:text-base">نحن هنا للإجابة على استفساراتك التقنية</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-12 text-right">
                <div className="space-y-6 md:space-y-8">
                  <div className="flex items-center gap-4 justify-end">
                    <div className="text-right">
                      <p className="text-sm text-gray-400">عُمان</p>
                      <p className="text-lg md:text-xl font-bold">+968 7644 8998</p>
                    </div>
                    <Phone className="text-secondary-blue w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <div className="flex items-center gap-4 justify-end">
                    <div className="text-right">
                      <p className="text-sm text-gray-400">السعودية</p>
                      <p className="text-lg md:text-xl font-bold">+966 54 757 8391</p>
                    </div>
                    <Phone className="text-secondary-blue w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <div className="flex items-center gap-4 justify-end">
                    <div>
                      <p className="text-lg md:text-xl font-bold">info@idesigner.com</p>
                    </div>
                    <Mail className="text-secondary-blue w-5 h-5 md:w-6 md:h-6" />
                  </div>
                </div>
                <div className="space-y-4">
                  <input type="text" placeholder="الاسم الكامل" className="w-full p-3 md:p-4 bg-[#002140] border border-[#003366] rounded-lg text-white focus:outline-none focus:border-secondary-blue text-sm md:text-base" />
                  <input type="email" placeholder="البريد الإلكتروني" className="w-full p-3 md:p-4 bg-[#002140] border border-[#003366] rounded-lg text-white focus:outline-none focus:border-secondary-blue text-sm md:text-base" />
                  <textarea rows={4} placeholder="كيف يمكننا مساعدتك؟" className="w-full p-3 md:p-4 bg-[#002140] border border-[#003366] rounded-lg text-white focus:outline-none focus:border-secondary-blue text-sm md:text-base"></textarea>
                  <button className="btn-green w-full border-none cursor-pointer justify-center py-3 md:py-4">إرسال الرسالة</button>
                </div>
              </div>
            </div>
          </section>
        );
      default:
        return null;
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary-dark">
        <Loader2 className="w-12 h-12 text-secondary-blue animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen rtl" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-primary-dark/90 backdrop-blur-sm border-b border-[#1a2a3a] py-4 px-6 md:px-[10%] flex justify-between items-center">
        <div className="text-2xl md:text-3xl font-bold cursor-pointer flex items-center gap-2 md:gap-3">
          {config.logoUrl ? (
            <img 
              src={config.logoUrl} 
              alt={config.logoText} 
              className="h-8 md:h-10 w-auto object-contain"
              referrerPolicy="no-referrer"
            />
          ) : (
            <>
              {config.logoText}<span className="text-secondary-blue">.</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          {user && (
            <button 
              onClick={() => setShowAdminPanel(!showAdminPanel)}
              className="p-2 bg-secondary-blue/20 text-secondary-blue rounded-full hover:bg-secondary-blue/30 transition-colors"
            >
              <Settings size={20} className="md:w-6 md:h-6" />
            </button>
          )}
          <button 
            onClick={() => openWhatsApp()}
            className="btn-green text-sm md:text-base px-4 py-2 md:px-6 md:py-3"
          >
            <MessageCircle size={18} className="md:w-5 md:h-5" />
            <span className="hidden xs:inline">تواصل مباشر</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main id="pageContent">
        <AnimatePresence mode="popLayout">
          {config.sections.map((section) => renderSection(section.id))}
        </AnimatePresence>
      </main>

      {/* Admin Panel Sidebar */}
      <AnimatePresence>
        {showAdminPanel && user && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAdminPanel(false)}
              className="fixed inset-0 bg-black/50 z-[9998]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 w-full sm:max-w-[350px] h-full bg-white text-primary-dark z-[9999] p-6 overflow-y-auto admin-panel-shadow"
            >
              <div className="flex justify-between items-center border-b-2 border-secondary-blue pb-4 mb-6">
                <h3 className="text-2xl font-bold">لوحة التحكم</h3>
                <button onClick={handleLogout} className="text-red-500 hover:text-red-600 flex items-center gap-1 font-bold">
                  <LogOut size={18} />
                  خروج
                </button>
              </div>

              {/* Logo Control */}
              <div className="bg-gray-50 p-4 rounded-xl mb-6">
                <h4 className="text-secondary-blue font-bold text-sm mb-3">تعديل الشعار (Brand Logo)</h4>
                <div className="space-y-3">
                  <input 
                    type="text" 
                    value={config.logoText}
                    onChange={(e) => updateLocalConfig({ logoText: e.target.value })}
                    placeholder="اسم البراند" 
                    className="w-full p-2 border border-gray-200 rounded focus:outline-none focus:border-secondary-blue" 
                  />
                  <input 
                    type="text" 
                    value={config.logoUrl || ''}
                    onChange={(e) => updateLocalConfig({ logoUrl: e.target.value })}
                    placeholder="رابط صورة الشعار (Logo URL)" 
                    className="w-full p-2 border border-gray-200 rounded focus:outline-none focus:border-secondary-blue" 
                  />
                </div>
              </div>

              {/* Hero Content Control */}
              <div className="bg-gray-50 p-4 rounded-xl mb-6">
                <h4 className="text-secondary-blue font-bold text-sm mb-3">تعديل قسم الهيرو</h4>
                <div className="space-y-3">
                  <input 
                    type="text" 
                    value={config.heroTitle}
                    onChange={(e) => updateLocalConfig({ heroTitle: e.target.value })}
                    placeholder="العنوان الرئيسي" 
                    className="w-full p-2 border border-gray-200 rounded focus:outline-none focus:border-secondary-blue" 
                  />
                  <textarea 
                    value={config.heroDesc}
                    onChange={(e) => updateLocalConfig({ heroDesc: e.target.value })}
                    placeholder="الوصف" 
                    rows={3}
                    className="w-full p-2 border border-gray-200 rounded focus:outline-none focus:border-secondary-blue" 
                  />
                </div>
              </div>

              {/* Section Ordering */}
              <div className="bg-gray-50 p-4 rounded-xl mb-6">
                <h4 className="text-secondary-blue font-bold text-sm mb-3">ترتيب وتحريك الأقسام</h4>
                <div className="space-y-2">
                  {config.sections.map((section, index) => (
                    <div key={section.id} className="flex justify-between items-center p-3 bg-white border border-gray-100 rounded-lg shadow-sm">
                      <span className="font-medium text-sm">{section.title}</span>
                      <div className="flex gap-2">
                        <button 
                          disabled={index === 0}
                          onClick={() => moveSection(index, 'up')}
                          className="p-1 text-secondary-blue disabled:text-gray-300 hover:bg-secondary-blue/10 rounded transition-colors"
                        >
                          <ArrowUp size={18} />
                        </button>
                        <button 
                          disabled={index === config.sections.length - 1}
                          onClick={() => moveSection(index, 'down')}
                          className="p-1 text-secondary-blue disabled:text-gray-300 hover:bg-secondary-blue/10 rounded transition-colors"
                        >
                          <ArrowDown size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add Client */}
              <div className="bg-gray-50 p-4 rounded-xl mb-6">
                <h4 className="text-secondary-blue font-bold text-sm mb-3">إضافة شريك/عميل جديد</h4>
                <div className="space-y-3">
                  <input 
                    type="text" 
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    placeholder="اسم العميل/الشركة" 
                    className="w-full p-2 border border-gray-200 rounded focus:outline-none focus:border-secondary-blue" 
                  />
                  <input 
                    type="text" 
                    value={newClientUrl}
                    onChange={(e) => setNewClientUrl(e.target.value)}
                    placeholder="رابط لوجو العميل (Image URL)" 
                    className="w-full p-2 border border-gray-200 rounded focus:outline-none focus:border-secondary-blue" 
                  />
                  <button 
                    onClick={addClient}
                    className="w-full btn-green py-2 text-sm justify-center"
                  >
                    <Plus size={16} />
                    إضافة
                  </button>
                </div>
              </div>

              <button 
                onClick={saveConfig}
                disabled={isSaving}
                className="w-full bg-secondary-blue text-white py-4 rounded-xl font-bold hover:bg-opacity-90 transition-opacity mt-4 flex items-center justify-center gap-2"
              >
                {isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                حفظ التغييرات النهائية
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* WhatsApp Selection Modal */}
      <AnimatePresence>
        {showWhatsAppModal && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowWhatsAppModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white text-primary-dark w-full max-w-md rounded-3xl p-8 shadow-2xl overflow-hidden"
            >
              <button 
                onClick={() => setShowWhatsAppModal(false)}
                className="absolute top-4 left-4 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>

              <div className="text-center mb-8">
                <div className="bg-whatsapp-green/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="text-whatsapp-green" size={32} />
                </div>
                <h3 className="text-2xl font-bold mb-2">تواصل معنا</h3>
                <p className="text-gray-500">اختر الفرع الأقرب إليك لبدء المحادثة</p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <a 
                  href="https://wa.me/966547578391" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-5 bg-gray-50 rounded-2xl border-2 border-transparent hover:border-whatsapp-green hover:bg-whatsapp-green/5 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-2xl">🇸🇦</div>
                    <div className="text-right">
                      <p className="font-bold text-lg">فرع المملكة العربية السعودية</p>
                      <p className="text-sm text-gray-500">+966 54 757 8391</p>
                    </div>
                  </div>
                  <MessageCircle className="text-gray-300 group-hover:text-whatsapp-green transition-colors" size={24} />
                </a>

                <a 
                  href="https://wa.me/96876448998" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-5 bg-gray-50 rounded-2xl border-2 border-transparent hover:border-whatsapp-green hover:bg-whatsapp-green/5 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-2xl">🇴🇲</div>
                    <div className="text-right">
                      <p className="font-bold text-lg">فرع سلطنة عُمان</p>
                      <p className="text-sm text-gray-500">+968 7644 8998</p>
                    </div>
                  </div>
                  <MessageCircle className="text-gray-300 group-hover:text-whatsapp-green transition-colors" size={24} />
                </a>
              </div>

              <p className="text-center text-xs text-gray-400 mt-8">
                نحن متاحون لخدمتكم على مدار الساعة
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
