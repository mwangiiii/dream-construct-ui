import { Link, useNavigate } from "react-router-dom";
import { Facebook, Twitter, Linkedin, Instagram, Mail, Phone, MapPin } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";

const Footer = () => {
  const navigate = useNavigate();

  const handleServiceClick = (serviceType: string) => {
    navigate('/services', { state: { scrollToService: serviceType } });
    // Scroll to top first, then the component will handle scrolling to the section
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleNavClick = (path: string) => {
    navigate(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const footerLinks = {
    company: [
      { name: "About Us", path: "/team" },
      { name: "Services", path: "/services" },
      { name: "Projects", path: "/projects" },
      { name: "Contact", path: "/contact" },
    ],
    services: [
      { name: "Residential", type: "Residential Construction" },
      { name: "Commercial", type: "Commercial Projects" },
      { name: "Industrial", type: "Industrial Construction" },
      { name: "Renovations", type: "Renovations & Remodeling" },
    ],
    legal: [
      { name: "Terms of Service", path: "#" },
    ],
  };

  const socialLinks = [
    { icon: Facebook, href: "#", label: "Facebook", isReactIcon: false },
    { icon: Twitter, href: "#", label: "Twitter", isReactIcon: false },
    { icon: Linkedin, href: "#", label: "LinkedIn", isReactIcon: false },
    { icon: Instagram, href: "#", label: "Instagram", isReactIcon: false },
    { icon: FaWhatsapp, href: "https://wa.me/254707063047", label: "WhatsApp", isReactIcon: true },
  ];

  return (
    <footer className="bg-card border-t border-border">
      <div className="container mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <button 
              onClick={() => handleNavClick("/")} 
              className="inline-flex items-center space-x-2 mb-4 hover:opacity-80 transition-opacity"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
                <span className="text-background font-bold text-xl">DC</span>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg leading-tight">Dream Construct</span>
                <span className="text-xs text-muted-foreground">Building your Dreams</span>
              </div>
            </button>
            <p className="text-muted-foreground text-sm mb-6 max-w-md">
              Excellence in construction. We bring your vision to life with innovative
              solutions, premium quality, and unwavering commitment to perfection.
            </p>
            <div className="flex space-x-4">
              {socialLinks.map((social) => {
                const IconComponent = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target={social.label === "WhatsApp" ? "_blank" : undefined}
                    rel={social.label === "WhatsApp" ? "noopener noreferrer" : undefined}
                    aria-label={social.label}
                    className="w-10 h-10 glass rounded-lg flex items-center justify-center hover:bg-primary/10 hover:border-primary/20 transition-all duration-300"
                  >
                    {social.isReactIcon ? (
                      <IconComponent size={18} />
                    ) : (
                      <IconComponent size={18} />
                    )}
                  </a>
                );
              })}
            </div>
          </div>

          {/* Company Links */}
          <div>
            <h3 className="font-semibold mb-4">Company</h3>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.name}>
                  <button
                    onClick={() => handleNavClick(link.path)}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors text-left"
                  >
                    {link.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Services Links */}
          <div>
            <h3 className="font-semibold mb-4">Services</h3>
            <ul className="space-y-3">
              {footerLinks.services.map((link) => (
                <li key={link.name}>
                  <button
                    onClick={() => handleServiceClick(link.type)}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors text-left"
                  >
                    {link.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="font-semibold mb-4">Contact</h3>
            <ul className="space-y-2">
              <li className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-muted-foreground">
                <MapPin size={14} className="mt-1 flex-shrink-0" />
                <span className="break-words max-w-[220px] sm:max-w-[320px] md:max-w-[400px] lg:max-w-[260px] xl:max-w-none">Kahawa-Sukari, Murang'a Road, Carjet Kenya Limited Warehouse, 70135 - 00400</span>
              </li>
              <li className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-muted-foreground hover:text-primary transition-colors">
                <Phone size={14} />
                <a href="tel:0707063047" className="break-all">0707063047</a>
              </li>
              <li className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-muted-foreground hover:text-primary transition-colors">
                <Mail size={14} className="mt-1 flex-shrink-0" />
                <a href="mailto:dreamconstruct254@gmail.com" className="break-all">dreamconstruct254@gmail.com</a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-border mt-12 pt-8 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Dream Construct System. All rights reserved.
          </p>
          <div className="flex space-x-6">
            {footerLinks.legal.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {link.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;