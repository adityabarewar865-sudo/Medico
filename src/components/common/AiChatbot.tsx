import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, User, Sparkles, Volume2 } from 'lucide-react';
import type { LanguageCode } from '../../types/clinical';
import { speech } from '../../services/speech';

interface AiChatbotProps {
  currentLanguage: LanguageCode;
  hospitalName?: string;
  hospitalAddress?: string;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
}

const CHAT_RESPONSES: Record<LanguageCode, Record<string, string>> = {
  hi: {
    welcome: 'नमस्ते! मैं मेडिकियोस्क अस्पताल सहायक हूँ। मैं आपको केस-टेकिंग, रजिस्ट्रेशन या अस्पताल सेवाओं में मदद कर सकता हूँ। (कृपया ध्यान दें: मैं अंतिम चिकित्सीय परामर्श नहीं दे सकता, परामर्श हेतु डॉक्टर से मिलें।)',
    helpFill: 'रजिस्ट्रेशन करने के लिए पहले अपनी भाषा चुनें, फिर नाम, उम्र और मोबाइल नंबर भरें। यदि कोई साथ आया है तो "मरीज के साथ आए व्यक्ति का विवरण" भी भर सकते हैं।',
    token: 'केस-टेकिंग पूरा होने के बाद आपको स्क्रीन पर ओपीडी टोकन नंबर और डॉक्टर का कमरा नंबर मिलेगा।',
    emergency: 'यदि सीने में तेज दर्द, सांस फूलना या बेहोशी जैसे गंभीर लक्षण हैं, तो तुरंत आपातकालीन कक्ष (कमरा नंबर 1) में जाएं!',
    abha: 'ABHA आईडी आयुष्मान भारत का डिजिटल हेल्थ कार्ड है। यह पूरी तरह से वैकल्पिक है, यदि आपके पास नहीं है तो भी आपकी पर्ची बनेगी।',
    doctor: 'केस दर्ज होने के बाद संबंधित मेडिकल ऑफिसर आपके लक्षणों और पिछली रिपोर्ट्स की जांच करेंगे और दवाएं लिखेंगे।',
    default: 'मैं आपकी अस्पताल प्रक्रिया में सहायता के लिए यहाँ हूँ। आप पंजीकरण, टोकन, आपातकालीन कक्ष या पुरानी पर्चियों के बारे में पूछ सकते हैं।',
  },
  en: {
    welcome: 'Hello! I am the Medikiosk Hospital Assistant. I can guide you with registration, case-taking, and hospital OPD services. (Note: I cannot provide medical diagnoses; your doctor will evaluate your condition.)',
    helpFill: 'To register, choose your language, enter your name, age, and mobile number. You can also add accompanying person details if someone came with you.',
    token: 'After submitting your symptoms, you will receive an official OPD Token and assigned consultation room number.',
    emergency: 'For severe chest pain, extreme breathlessness, or collapse, report immediately to Room 1 Emergency Resus!',
    abha: 'ABHA ID is Ayushman Bharat Digital Health ID. It is completely optional—your consultation will proceed normally even without it.',
    doctor: 'The assigned medical officer will review your AI summary, verify clinical details, author your prescription, and sign your receipt.',
    default: 'I am here to guide your visit. You can ask about registration, OPD queue tokens, emergency care, or uploading past prescriptions.',
  },
  pa: {
    welcome: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਮੈਡੀਕਿਓਸਕ ਹਸਪਤਾਲ ਸਹਾਇਕ ਹਾਂ। ਮੈਂ ਰਜਿਸਟ੍ਰੇਸ਼ਨ ਅਤੇ ਓਪੀਡੀ ਸੇਵਾਵਾਂ ਵਿੱਚ ਤੁਹਾਡੀ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ। (ਧਿਆਨ ਦਿਓ: ਮੈਂ ਡਾਕਟਰੀ ਇਲਾਜ ਦਾ ਫੈਸਲਾ ਨਹੀਂ ਕਰ ਸਕਦਾ, ਡਾਕਟਰ ਨਾਲ ਸੰਪਰਕ ਕਰੋ।)',
    helpFill: 'ਰਜਿਸਟਰ ਕਰਨ ਲਈ ਆਪਣੀ ਭਾਸ਼ਾ ਚੁਣੋ, ਨਾਮ, ਉਮਰ ਅਤੇ ਮੋਬਾਈਲ ਨੰਬਰ ਭਰੋ। ਨਾਲ ਆਏ ਵਿਅਕਤੀ ਦਾ ਵੇਰਵਾ ਵੀ ਜੋੜ ਸਕਦੇ ਹੋ।',
    token: 'ਕੇਸ ਪੂਰਾ ਹੋਣ ਤੋਂ ਬਾਅਦ ਤੁਹਾਨੂੰ ਓਪੀਡੀ ਟੋਕਨ ਨੰਬਰ ਅਤੇ ਕਮਰਾ ਨੰਬਰ ਮਿਲੇਗਾ।',
    emergency: 'ਜੇਕਰ ਛਾਤੀ ਵਿੱਚ ਤੇਜ਼ ਦਰਦ ਜਾਂ ਸਾਹ ਚੜ੍ਹ ਰਿਹਾ ਹੈ, ਤਾਂ ਤੁਰੰਤ ਐਮਰਜੈਂਸੀ ਰੂਮ (ਕਮਰਾ ਨੰਬਰ 1) ਵਿੱਚ ਜਾਓ!',
    abha: 'ABHA ID ਬਿਲਕੁਲ ਵਿਕਲਪਿਕ ਹੈ। ਜੇਕਰ ਤੁਹਾਡੇ ਕੋਲ ਇਹ ਨਹੀਂ ਹੈ, ਤਾਂ ਵੀ ਤੁਹਾਡਾ ਚੈੱਕਅੱਪ ਹੋਵੇਗਾ।',
    doctor: 'ਡਾਕਟਰ ਤੁਹਾਡੇ ਕੇਸ ਦੀ ਜਾਂਚ ਕਰਨਗੇ ਅਤੇ ਦਵਾਈਆਂ ਲਿਖਣਗੇ।',
    default: 'ਮੈਂ ਤੁਹਾਡੀ ਹਸਪਤਾਲ ਪ੍ਰਕਿਰਿਆ ਵਿੱਚ ਮਦਦ ਲਈ ਹਾਜ਼ਰ ਹਾਂ। ਤੁਸੀਂ ਟੋਕਨ, ਐਮਰਜੈਂਸੀ ਜਾਂ ਰਜਿਸਟ੍ਰੇਸ਼ਨ ਬਾਰੇ ਪੁੱਛ ਸਕਦੇ ਹੋ।',
  },
  bn: {
    welcome: 'নমস্কার! আমি মেডিকো হাসপাতাল সহকারী। আমি আপনাকে ওপিডি রেজিস্ট্রেশন এবং কেস-টেকিং প্রক্রিয়ায় সহায়তা করতে পারি।',
    helpFill: 'রেজিস্ট্রেশনের জন্য প্রথমে ভাষা বেছে নিন, তারপর নাম, বয়স ও মোবাইল নম্বর দিন। সাথে আসা ব্যক্তির বিবরণও দিতে পারেন।',
    token: 'কেস জমা দেওয়ার পর আপনি ওপিডি টোকেন ও ডাক্তারের রুম নম্বর পাবেন।',
    emergency: 'তীব্র বুকে ব্যথা বা শ্বাসকষ্ট হলে অবিলম্বে জরুরি কক্ষে যান!',
    abha: 'ABHA আইডি সম্পূর্ণ ঐচ্ছিক। এটি ছাড়াও আপনার ওপিডি পরামর্শ চলবে।',
    doctor: 'ডাক্তারবাবু আপনার সমস্ত রিপোর্ট দেখে ওষুধ ও পরামর্শ দেবেন।',
    default: 'হাসপাতালের পরিষেবা সম্পর্কে যেকোনো প্রশ্ন জিজ্ঞাসা করতে পারেন।',
  },
  mr: {
    welcome: 'नमस्कार! मी मेदिको रुग्णालय सहाय्यक आहे. मी तुम्हाला केस-टेकिंग आणि ओपीडी नोंदणीसाठी मदत करू शकतो.',
    helpFill: 'नोंदणीसाठी नाव, वय आणि फोन नंबर भरा. सोबत आलेल्या व्यक्तीची माहितीही जोडू शकता.',
    token: 'केस पूर्ण झाल्यावर तुम्हाला ओपीडी टोकन आणि डॉक्टर खोली क्रमांक मिळेल.',
    emergency: 'छातीत तीव्र वेदना किंवा श्वास घेण्यास त्रास असल्यास त्वरित आपत्कालीन कक्षात जा!',
    abha: 'ABHA आयडी पूर्णपणे ऐच्छिक आहे.',
    doctor: 'डॉक्टर तुमच्या आजाराचे परीक्षण करून योग्य औषधे लिहून देतील.',
    default: 'रुग्णालय मार्गदर्शनासाठी मी येथे आहे. तुम्ही प्रश्न विचारू शकता.',
  },
  te: {
    welcome: 'నమస్కారం! నేను మెడికో హాస్పిటల్ అసిస్టెంట్. నేను మీకు రిజిస్ట్రేషన్ మరియు ఓపీడీ సేవలలో సహాయం చేయగలను.',
    helpFill: 'రిజిస్ట్రేషన్ కోసం మీ పేరు, వయస్సు, ఫోన్ నంబర్ నమోదు చేయండి.',
    token: 'వివరాలు సమర్పించిన తర్వాత మీకు OPD టోకెన్ నంబర్ లభిస్తుంది.',
    emergency: 'తీవ్రమైన గుండెనొప్పి లేదా శ్వాస ఆడకపోతే వెంటనే ఎమర్జెన్సీ గదికి వెళ్ళండి!',
    abha: 'ABHA ఐడీ ఐచ్ఛికం మాత్రమే.',
    doctor: 'డాక్టర్ గారు మీ కేసు పరిశీలించి ప్రిస్క్రిప్షన్ ఇస్తారు.',
    default: 'హాస్పిటల్ సేవల గురించి మీరు ఏమైనా అడగవచ్చు.',
  },
  ta: {
    welcome: 'வணக்கம்! நான் மெடிகோ மருத்துவமனை உதவியாளர். நான் உங்களுக்கு பதிவு மற்றும் OPD சேவைகளில் வழிகாட்ட முடியும்.',
    helpFill: 'பதிவு செய்ய பெயர், வயது, அலைபேசி எண்ணை உள்ளிடவும்.',
    token: 'விవరங்களை சமர்ப்பித்த பின் OPD டோக்கன் எண் வழங்கப்படும்.',
    emergency: 'கடுமையான நெஞ்சுவலி அல்லது மூச்சுத்திணறல் இருந்தால் உடனே அவசர சிகிச்சைப் பிரிவுக்குச் செல்லவும்!',
    abha: 'ABHA எண் கட்டாயமில்லை, விருப்பமானது.',
    doctor: 'மருத்துவர் உங்கள் அறிகுறிகளை ஆய்வு செய்து சிகிச்சை அளிப்பார்.',
    default: 'மருத்துவமனை வழிகாட்டலுக்கு நீங்கள் என்னிடம் கேட்கலாம்.',
  },
};

export const AiChatbot: React.FC<AiChatbotProps> = ({
  currentLanguage,
  hospitalName = 'District Hospital',
  hospitalAddress = 'Hospital Complex',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const langKey = CHAT_RESPONSES[currentLanguage] ? currentLanguage : 'en';
  const localized = CHAT_RESPONSES[langKey];

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome_msg',
      sender: 'bot',
      text: localized.welcome,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userText = input.trim();
    const newMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, newMsg]);
    setInput('');

    // Safe contextual response matching
    setTimeout(() => {
      const lower = userText.toLowerCase();
      let botResponse = localized.default;

      if (lower.includes('token') || lower.includes('टोकन') || lower.includes('ਟੋਕਨ') || lower.includes('slip') || lower.includes('queue')) {
        botResponse = localized.token;
      } else if (lower.includes('fill') || lower.includes('register') || lower.includes('फॉर्म') || lower.includes('ਨਾਮ') || lower.includes('attendant') || lower.includes('साथ')) {
        botResponse = localized.helpFill;
      } else if (lower.includes('emergency') || lower.includes('सीने में दर्द') || lower.includes('chest') || lower.includes('heart') || lower.includes('सांस')) {
        botResponse = localized.emergency;
      } else if (lower.includes('abha') || lower.includes('card') || lower.includes('आयुष्मान') || lower.includes('ਆਯੁਸ਼ਮਾਨ')) {
        botResponse = localized.abha;
      } else if (lower.includes('doctor') || lower.includes('डॉक्टर') || lower.includes('ਡਾਕਟਰ') || lower.includes('medicine') || lower.includes('दवा')) {
        botResponse = localized.doctor;
      } else if (lower.includes('hospital') || lower.includes('address') || lower.includes('पता') || lower.includes('ਕਿੱਥੇ') || lower.includes('where')) {
        botResponse = `${hospitalName} - ${hospitalAddress}. OPD services are open 24/7 for emergency and 8:00 AM - 2:00 PM for routine consultations.`;
      }

      const reply: ChatMessage = {
        id: `bot_${Date.now()}`,
        sender: 'bot',
        text: botResponse,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, reply]);
    }, 450);
  };

  const handleSpeak = (text: string) => {
    speech.speak(text, currentLanguage);
  };

  return (
    <div className="fixed bottom-5 right-5 z-40 no-print">
      {/* Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="px-4 py-3 bg-gradient-to-r from-teal-600 to-sky-700 hover:from-teal-700 hover:to-sky-800 text-white rounded-full shadow-xl flex items-center gap-2.5 transition-all transform hover:scale-105 active:scale-95 cursor-pointer border-2 border-white/40"
          title="Open AI Hospital Assistant"
        >
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-xs font-black leading-tight">AI Assistant</div>
            <div className="text-[10px] text-teal-100 font-semibold leading-tight">Hospital Guide</div>
          </div>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="w-[340px] sm:w-[380px] h-[500px] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="bg-gradient-to-r from-teal-700 to-sky-800 text-white p-4 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="font-black text-sm leading-tight flex items-center gap-1.5">
                  <span>AI Hospital Guide</span>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                </h4>
                <p className="text-[10px] text-teal-100 font-medium">
                  {hospitalName} • Navigation & Help
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-full hover:bg-white/20 transition-colors text-white/80 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Clinical Disclaimer Banner */}
          <div className="bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-900/60 p-2 text-[10px] text-amber-900 dark:text-amber-200 font-semibold text-center leading-tight">
            ⚠️ Informational guide only. Not a medical doctor. Consult attending physician for diagnosis.
          </div>

          {/* Message List */}
          <div className="flex-1 p-3.5 space-y-3 overflow-y-auto bg-slate-50 dark:bg-slate-950/60">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 text-xs ${
                  msg.sender === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.sender === 'bot' && (
                  <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}
                <div
                  className={`p-3 rounded-2xl max-w-[80%] space-y-1 ${
                    msg.sender === 'user'
                      ? 'bg-teal-600 text-white rounded-br-none shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-none shadow-xs'
                  }`}
                >
                  <p className="leading-relaxed whitespace-pre-line">{msg.text}</p>
                  <div className="flex items-center justify-between gap-2 pt-0.5 text-[9px] opacity-70">
                    <span>{msg.timestamp}</span>
                    {msg.sender === 'bot' && (
                      <button
                        onClick={() => handleSpeak(msg.text)}
                        className="hover:text-teal-600 transition-colors"
                        title="Listen to message"
                      >
                        <Volume2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
                {msg.sender === 'user' && (
                  <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick FAQ Pills */}
          <div className="p-2 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex gap-1.5 overflow-x-auto text-[11px]">
            <button
              onClick={() => {
                setInput('How do I fill my details?');
              }}
              className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300 font-semibold whitespace-nowrap hover:bg-teal-50 hover:text-teal-700"
            >
              📝 How to fill?
            </button>
            <button
              onClick={() => {
                setInput('Where is my token?');
              }}
              className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300 font-semibold whitespace-nowrap hover:bg-teal-50 hover:text-teal-700"
            >
              🎟️ OPD Token?
            </button>
            <button
              onClick={() => {
                setInput('What is ABHA?');
              }}
              className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300 font-semibold whitespace-nowrap hover:bg-teal-50 hover:text-teal-700"
            >
              🆔 ABHA ID?
            </button>
          </div>

          {/* Input Bar */}
          <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask a question..."
              className="flex-1 px-3.5 py-2 text-xs font-medium rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button
              onClick={handleSend}
              className="p-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
