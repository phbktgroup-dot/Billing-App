import React from 'react';
import { motion } from 'motion/react';
import { 
  Mail, 
  Phone, 
  MessageSquare, 
  Clock, 
  Globe, 
  ShieldCheck, 
  HelpCircle,
  ExternalLink,
  ArrowRight
} from 'lucide-react';

export default function Support() {
  const contactMethods = [
    {
      icon: Mail,
      title: 'Email Support',
      value: 'info@phbkt.com',
      description: 'Our team typically responds within 2-4 business hours.',
      action: 'mailto:info@phbkt.com',
      color: 'bg-blue-50 text-blue-600'
    },
    {
      icon: Phone,
      title: 'Primary Support',
      value: '+91 7972688626',
      description: 'Available Mon-Sat, 10:00 AM to 7:00 PM IST.',
      action: 'tel:+917972688626',
      color: 'bg-green-50 text-green-600'
    },
    {
      icon: Phone,
      title: 'Secondary Support',
      value: '+91 9552256325',
      description: 'Alternative line for urgent billing queries.',
      action: 'tel:+919552256325',
      color: 'bg-purple-50 text-purple-600'
    }
  ];

  const faqs = [
    {
      question: 'How do I generate an E-way bill?',
      answer: 'Go to the Sales Invoice section, select an invoice, and click on the "E-Way Bill" button to fill in the transporter details and generate the JSON.'
    },
    {
      question: 'Can I customize my invoice template?',
      answer: 'Yes, you can upload your logo and set your business details in the Settings section. These will automatically appear on all generated invoices.'
    },
    {
      question: 'Is my data secure?',
      answer: 'We use enterprise-grade encryption and secure cloud storage to ensure your business data is always protected and backed up.'
    }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header Section */}
      <div className="text-center space-y-4">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-2"
        >
          <HelpCircle size={32} />
        </motion.div>
        <h1 className="text-3xl font-bold text-slate-900">Help & Support Center</h1>
        <p className="text-slate-500 max-w-2xl mx-auto">
          Need assistance with PHBKT Billing Pro+? Our dedicated support team is here to help you streamline your business operations.
        </p>
      </div>

      {/* Contact Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {contactMethods.map((method, index) => (
          <motion.a
            key={index}
            href={method.action}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: index * 0.1 }}
            className="group p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-primary/20 transition-all duration-300"
          >
            <div className={`w-12 h-12 rounded-xl ${method.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
              <method.icon size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">{method.title}</h3>
            <p className="text-primary font-semibold mb-3">{method.value}</p>
            <p className="text-sm text-slate-500 mb-4">{method.description}</p>
            <div className="flex items-center text-sm font-medium text-primary group-hover:translate-x-1 transition-transform">
              Contact Now <ArrowRight size={16} className="ml-1" />
            </div>
          </motion.a>
        ))}
      </div>

      {/* Main Support Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* FAQ Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="text-primary" size={20} />
            <h2 className="text-xl font-bold text-slate-900">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="p-5 bg-slate-50 rounded-xl border border-slate-100">
                <h4 className="font-bold text-slate-900 mb-2">{faq.question}</h4>
                <p className="text-slate-600 text-sm leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Support Info Sidebar */}
        <div className="space-y-6">
          <div className="p-6 bg-primary text-white rounded-2xl shadow-lg shadow-primary/20">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Clock size={20} />
              Support Hours
            </h3>
            <div className="space-y-3 text-sm opacity-90">
              <div className="flex justify-between">
                <span>Monday - Friday</span>
                <span>10:00 - 19:00</span>
              </div>
              <div className="flex justify-between">
                <span>Saturday</span>
                <span>10:00 - 17:00</span>
              </div>
              <div className="flex justify-between text-white/60">
                <span>Sunday</span>
                <span>Closed</span>
              </div>
            </div>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck size={20} className="text-green-500" />
              Enterprise Support
            </h3>
            <p className="text-sm text-slate-500">
              For enterprise customers, we provide dedicated account managers and 24/7 priority support.
            </p>
            <button className="w-full py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors">
              Upgrade Plan
            </button>
          </div>

          <div className="flex flex-col items-center text-center p-6 space-y-2">
            <Globe className="text-slate-300" size={40} />
            <p className="text-xs text-slate-400">
              © 2026 PHBKT Group. All rights reserved.<br />
              Pune, Maharashtra, India
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
