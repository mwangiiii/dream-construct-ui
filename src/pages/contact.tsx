// src/pages/Contact.tsx or src/app/contact/page.tsx
// FINAL PRODUCTION-READY VERSION - Fixed Business Hours overlap

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { 
  Mail, 
  Phone, 
  MapPin, 
  Send, 
  CheckCircle, 
  Loader2,
  AlertCircle,
  Clock,
  User,
  MessageSquare
} from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const Contact = () => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [queryParams, setQueryParams] = useState({
    subService: "",
    category: "",
    stage: "",
  });
  const [showBanner, setShowBanner] = useState(false);

  // Pre-fill form from query parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const subService = params.get("subService") || "";
    const category = params.get("category") || "";
    const stage = params.get("stage") || "";

    setQueryParams({ subService, category, stage });

    if (subService && stage) {
      setShowBanner(true);
      const newSubject = `${subService} – ${stage} Stage`;
      const newMessage = `Hello,

I am interested in your ${subService} services under ${category} and I am currently at the ${stage} stage of my project.

I would like to discuss the following:

`;

      setFormData((prev) => ({
        ...prev,
        subject: newSubject,
        message: newMessage,
      }));
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const submitData = {
      ...formData,
      subService: queryParams.subService,
      category: queryParams.category,
      stage: queryParams.stage,
    };

    try {
      const response = await fetch("/api/sendMail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitData),
      });

      const result = await response.json();

      if (response.ok) {
        setIsSuccess(true);
        toast({
          title: "Message Sent Successfully!",
          description: "We've received your inquiry and will respond within 24 hours.",
        });
        
        setTimeout(() => {
          setFormData({ name: "", email: "", phone: "", subject: "", message: "" });
          setIsSuccess(false);
          setShowBanner(false);
          
          window.history.replaceState({}, "", window.location.pathname);
          setQueryParams({ subService: "", category: "", stage: "" });
        }, 3000);
      } else {
        throw new Error(result.error || "Failed to send email");
      }
    } catch (error) {
      console.error("Contact form error:", error);
      toast({
        title: "Error Sending Message",
        description: "Please try again or contact us directly via phone or email.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const contactInfo = [
    {
      icon: MapPin,
      title: "Visit Us",
      details: ["123 Construction Avenue", "Nairobi, Kenya"],
      link: "https://maps.google.com/?q=Nairobi,Kenya",
    },
    {
      icon: Phone,
      title: "Call Us",
      details: ["+254 707 063 047", "Mon-Fri: 8AM - 6PM"],
      link: "tel:+254707063047",
    },
    {
      icon: Mail,
      title: "Email Us",
      details: ["mwangiwanjiku033@gmail.com"],
      link: "mailto:mwangiwanjiku033@gmail.com",
    },
  ];

  return (
    <div className="min-h-screen pt-32 pb-20 bg-gradient-to-b from-background to-background/80">
      <div className="container mx-auto px-6">
        <SectionHeading
          title="Get In Touch"
          subtitle="Let's discuss your project and bring your vision to life"
          className="mb-16"
        />

        {/* Query Params Info Banner */}
        <AnimatePresence>
          {showBanner && queryParams.subService && queryParams.stage && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ type: "spring", damping: 20 }}
              className="mb-8"
            >
              <GlassCard className="p-5 border-l-4 border-primary shadow-lg">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                    <CheckCircle className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-base flex items-center gap-2">
                        Inquiry Details Pre-filled
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Ready to Submit
                        </span>
                      </h3>
                      <button
                        onClick={() => setShowBanner(false)}
                        className="text-muted-foreground hover:text-primary transition-colors"
                        aria-label="Dismiss banner"
                      >
                        <AlertCircle className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Service:</span>
                        <span className="font-semibold text-primary">{queryParams.subService}</span>
                      </div>
                      <span className="text-muted-foreground/30">•</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Stage:</span>
                        <span className="font-semibold text-accent">{queryParams.stage}</span>
                      </div>
                      <span className="text-muted-foreground/30">•</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Category:</span>
                        <span className="font-medium">{queryParams.category}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Contact Info Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {contactInfo.map((info, idx) => (
            <motion.div
              key={info.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1, duration: 0.5 }}
            >
              <a
                href={info.link}
                target={info.icon === MapPin ? "_blank" : undefined}
                rel={info.icon === MapPin ? "noopener noreferrer" : undefined}
                className="block h-full group"
              >
                <GlassCard className="text-center h-full hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <info.icon className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-3 group-hover:text-primary transition-colors">
                    {info.title}
                  </h3>
                  <div className="space-y-1">
                    {info.details.map((detail, i) => (
                      <p key={i} className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                        {detail}
                      </p>
                    ))}
                  </div>
                </GlassCard>
              </a>
            </motion.div>
          ))}
        </div>

        {/* Main Grid: Form + Right Column */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16">
          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <GlassCard className="p-8 shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-primary/10">
                  <MessageSquare className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">Send us a Message</h3>
                  <p className="text-sm text-muted-foreground">We'll respond within 24 hours</p>
                </div>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-sm font-medium flex items-center gap-2">
                      <User className="w-4 h-4 text-primary" />
                      Full Name *
                    </label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="John Doe"
                      required
                      disabled={isLoading || isSuccess}
                      className="glass border-border focus:border-primary transition-colors h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium flex items-center gap-2">
                      <Mail className="w-4 h-4 text-primary" />
                      Email Address *
                    </label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="john@example.com"
                      required
                      disabled={isLoading || isSuccess}
                      className="glass border-border focus:border-primary transition-colors h-12"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="phone" className="text-sm font-medium flex items-center gap-2">
                      <Phone className="w-4 h-4 text-primary" />
                      Phone Number
                    </label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="+254 707 063 047"
                      disabled={isLoading || isSuccess}
                      className="glass border-border focus:border-primary transition-colors h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="subject" className="text-sm font-medium flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-primary" />
                      Subject *
                    </label>
                    <Input
                      id="subject"
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      placeholder="Project Inquiry"
                      required
                      disabled={isLoading || isSuccess}
                      className="glass border-border focus:border-primary transition-colors h-12"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="message" className="text-sm font-medium flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    Message *
                  </label>
                  <Textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    placeholder="Tell us about your project, timeline, budget, and any specific requirements..."
                    rows={8}
                    required
                    disabled={isLoading || isSuccess}
                    className="glass border-border focus:border-primary transition-colors resize-none"
                  />
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Average response time: 2-4 hours during business hours
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || isSuccess}
                  className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white font-semibold py-6 transition-all duration-300 shadow-lg hover:shadow-xl relative overflow-hidden group"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Sending Message...
                    </span>
                  ) : isSuccess ? (
                    <span className="flex items-center justify-center gap-2">
                      <CheckCircle className="w-5 h-5" />
                      Message Sent Successfully!
                    </span>
                  ) : (
                    <>
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        Send Message
                        <Send className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                      </span>
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                        initial={{ x: "-100%" }}
                        whileHover={{ x: "100%" }}
                        transition={{ duration: 0.6 }}
                      />
                    </>
                  )}
                </Button>

                <AnimatePresence>
                  {isSuccess && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-center"
                    >
                      <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                        Your message has been sent! We'll get back to you soon.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </form>
            </GlassCard>
          </motion.div>

          {/* Right Column: Map + Business Hours (Properly Stacked & Spaced) */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col gap-8 lg:gap-12"
          >
            {/* Map */}
            <GlassCard className="p-0 overflow-hidden h-[400px] shadow-xl flex-shrink-0">
              <div className="w-full h-full bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center relative group">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNnoiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utb3BhY2l0eT0iLjA1IiBzdHJva2Utd2lkdGg9IjIiLz48L2c+PC9zdmc+')] opacity-20" />
                <div className="text-center p-8 relative z-10">
                  <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <MapPin className="w-20 h-20 text-primary mx-auto mb-4" />
                  </motion.div>
                  <h4 className="text-2xl font-semibold mb-2">Our Location</h4>
                  <p className="text-muted-foreground mb-4">Nairobi, Kenya</p>
                  <p className="text-sm text-muted-foreground/70 mb-6">
                    Interactive map integration available
                  </p>
                  <Button
                    variant="outline"
                    className="glass border-primary/20 hover:bg-primary/10"
                    onClick={() => window.open("https://maps.google.com/?q=Nairobi,Kenya", "_blank")}
                  >
                    View on Google Maps
                  </Button>
                </div>
              </div>
            </GlassCard>

            {/* Business Hours - Now properly placed with spacing */}
            <GlassCard className="p-6 shadow-xl flex-shrink-0">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <h4 className="text-lg font-semibold">Business Hours</h4>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-sm font-medium">Monday - Friday</span>
                  <span className="text-sm text-primary font-semibold">8:00 AM - 6:00 PM</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-sm font-medium">Saturday</span>
                  <span className="text-sm text-muted-foreground">9:00 AM - 2:00 PM</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm font-medium">Sunday</span>
                  <span className="text-sm text-muted-foreground">Closed</span>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        </div>

        {/* Extra bottom padding to ensure no footer overlap */}
        <div className="h-20 lg:h-32" />
      </div>
    </div>
  );
};

export default Contact;