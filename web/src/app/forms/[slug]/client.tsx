'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  CheckCircle2,
  AlertCircle,
  Lock,
  ChevronDown,
  Loader2,
  Calendar,
  Globe,
  MapPin,
  Check,
} from 'lucide-react';
import { getApiBase } from '@/lib/api';

const COUNTRY_CODES = [
  { code: '+91', label: 'India (+91)', flag: '🇮🇳' },
  { code: '+1', label: 'United States (+1)', flag: '🇺🇸' },
  { code: '+44', label: 'United Kingdom (+44)', flag: '🇬🇧' },
  { code: '+971', label: 'UAE (+971)', flag: '🇦🇪' },
  { code: '+65', label: 'Singapore (+65)', flag: '🇸🇬' },
  { code: '+61', label: 'Australia (+61)', flag: '🇦🇺' },
  { code: '+1', label: 'Canada (+1)', flag: '🇨🇦' },
  { code: '+49', label: 'Germany (+49)', flag: '🇩🇪' },
  { code: '+966', label: 'Saudi Arabia (+966)', flag: '🇸🇦' },
];

export default function PublicFormPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const router = useRouter();

  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form values state
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [countryCode, setCountryCode] = useState('+91');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ message: string; redirectUrl?: string | null }>({
    message: '',
  });

  useEffect(() => {
    if (!slug) return;

    async function loadPublicForm() {
      try {
        setLoading(true);
        setError('');
        const apiBase = getApiBase();
        const res = await fetch(`${apiBase}/forms/public/${slug}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Form not found or currently closed.');
        }
        const data = await res.json();
        setForm(data.form);
      } catch (err: any) {
        setError(err.message || 'Failed to load form.');
      } finally {
        setLoading(false);
      }
    }

    loadPublicForm();
  }, [slug]);

  const getParsedSections = () => {
    if (!form?.fieldsJson) return [];
    try {
      const parsed = JSON.parse(form.fieldsJson);
      if (Array.isArray(parsed)) {
        if (parsed.length > 0 && parsed[0].fields) {
          return parsed;
        }
        return [
          {
            id: 'default-sec',
            title: 'Contact Information',
            description: '',
            fields: parsed,
          },
        ];
      }
    } catch (e) {}
    return [];
  };

  const getParsedSettings = () => {
    if (!form?.settingsJson) return {};
    try {
      return JSON.parse(form.settingsJson);
    } catch (e) {}
    return {};
  };

  const getParsedCustomize = () => {
    if (!form?.customizeJson) return {};
    try {
      return JSON.parse(form.customizeJson);
    } catch (e) {}
    return {};
  };

  // Evaluate dynamic conditional rules for showing/hiding fields
  const isFieldVisible = (fieldId: string) => {
    const settings = getParsedSettings();
    const rules = settings.conditionalRules || [];
    for (const rule of rules) {
      if (rule.targetFieldId === fieldId) {
        const triggerVal = formData[rule.fieldId] || '';
        let matches = false;
        if (rule.operator === 'equals') {
          matches = String(triggerVal).toLowerCase() === String(rule.value).toLowerCase();
        } else if (rule.operator === 'not_equals') {
          matches = String(triggerVal).toLowerCase() !== String(rule.value).toLowerCase();
        } else if (rule.operator === 'contains') {
          matches = String(triggerVal).toLowerCase().includes(String(rule.value).toLowerCase());
        } else if (rule.operator === 'not_empty') {
          matches = String(triggerVal).trim().length > 0;
        }

        if (rule.action === 'show') {
          return matches;
        } else if (rule.action === 'hide') {
          return !matches;
        }
      }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;

    try {
      setSubmitting(true);
      setError('');

      // Find phone field
      let rawPhone = formData.phone || formData['f-phone'] || '';
      if (!rawPhone) {
        const sections = getParsedSections();
        for (const s of sections) {
          for (const f of s.fields) {
            if (f.type === 'phone' || f.isLeadCapture) {
              rawPhone = formData[f.id] || '';
              break;
            }
          }
        }
      }

      if (!rawPhone) {
        setError('Phone number is required to submit this form.');
        setSubmitting(false);
        return;
      }

      const fullPhone = `${countryCode}${rawPhone.replace(/^0+/, '')}`;

      // Build payload
      const payload: Record<string, any> = {
        phone: fullPhone,
        fullName: formData.fullName || formData['f-name'] || formData.name || undefined,
        email: formData.email || formData['f-email'] || undefined,
        company: formData.company || undefined,
        ...formData,
      };

      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/forms/public/${slug}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Failed to submit form.');
      }

      setSubmitted(true);
      setSuccessInfo({
        message: result.message || 'Thank you! Your inquiry has been received.',
        redirectUrl: result.redirectUrl,
      });

      if (result.redirectUrl) {
        setTimeout(() => {
          window.location.href = result.redirectUrl;
        }, 1800);
      }
    } catch (err: any) {
      setError(err.message || 'Submission failed. Please check your inputs.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-sm font-medium">Loading form...</span>
        </div>
      </div>
    );
  }

  if (error && !form) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white max-w-md w-full p-8 rounded-3xl border border-slate-200 text-center shadow-lg">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-900 mb-1">Form Unavailable</h2>
          <p className="text-sm text-slate-500 mb-6">{error}</p>
        </div>
      </div>
    );
  }

  const sections = getParsedSections();
  const customize = getParsedCustomize();

  const highlightColor = customize.highlightColor || '#0284c7';
  const bgColor = customize.bgColor || '#ffffff';
  const textColor = customize.textColor || '#0f172a';
  const buttonText = customize.buttonText || 'Submit Inquiry';

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center py-12 px-4 sm:px-6">
      <div
        className="w-full max-w-xl rounded-3xl shadow-xl border border-slate-200/80 overflow-hidden transition-all"
        style={{ backgroundColor: bgColor }}
      >
        {/* Accent Bar */}
        <div className="h-2.5 w-full" style={{ backgroundColor: highlightColor }} />

        {submitted ? (
          <div className="p-8 sm:p-12 text-center animate-fade-in space-y-4">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto border border-emerald-200">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold" style={{ color: textColor }}>
              Inquiry Received!
            </h2>
            <p className="text-sm opacity-80 max-w-md mx-auto leading-relaxed" style={{ color: textColor }}>
              {successInfo.message}
            </p>
            {successInfo.redirectUrl && (
              <p className="text-xs text-slate-400 mt-2">
                Redirecting you in a few seconds...
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 sm:p-10 space-y-6">
            {/* Header */}
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: textColor }}>
                {form.name || 'Inquiry Form'}
              </h1>
              {form.description && (
                <p className="text-xs sm:text-sm opacity-70" style={{ color: textColor }}>
                  {form.description}
                </p>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Sections & Fields */}
            {sections.map((section: any) => (
              <div key={section.id} className="space-y-4">
                {section.title && (
                  <div className="border-b pb-2" style={{ borderColor: `${textColor}15` }}>
                    <h3 className="text-sm font-bold" style={{ color: textColor }}>
                      {section.title}
                    </h3>
                    {section.description && (
                      <p className="text-xs opacity-60 mt-0.5" style={{ color: textColor }}>
                        {section.description}
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-4">
                  {section.fields.map((field: any) => {
                    if (!isFieldVisible(field.id)) return null;

                    const isPhone = field.type === 'phone' || field.isLeadCapture;
                    const fieldKey = field.id || field.type;

                    return (
                      <div key={field.id} className="space-y-1.5 animate-in fade-in duration-150">
                        <label
                          htmlFor={field.id}
                          className="text-xs font-semibold block"
                          style={{ color: textColor }}
                        >
                          {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>

                        {/* Phone Field */}
                        {isPhone ? (
                          <div className="flex items-center gap-2">
                            <select
                              value={countryCode}
                              onChange={(e) => setCountryCode(e.target.value)}
                              className="px-2.5 py-2.5 bg-slate-100 rounded-xl text-xs font-bold text-slate-700 border border-slate-300 outline-none"
                            >
                              {COUNTRY_CODES.map((c) => (
                                <option key={c.code} value={c.code}>
                                  {c.flag} {c.code}
                                </option>
                              ))}
                            </select>
                            <input
                              id={field.id}
                              type="tel"
                              required={field.required}
                              placeholder={field.placeholder || 'Enter phone number'}
                              value={formData[fieldKey] || ''}
                              onChange={(e) =>
                                setFormData((prev) => ({ ...prev, [fieldKey]: e.target.value }))
                              }
                              className="flex-1 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm border border-slate-300 bg-white/95 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        ) : field.type === 'longText' ? (
                          <textarea
                            id={field.id}
                            rows={3}
                            required={field.required}
                            placeholder={field.placeholder}
                            value={formData[fieldKey] || ''}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, [fieldKey]: e.target.value }))
                            }
                            className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm border border-slate-300 bg-white/95 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                          />
                        ) : field.type === 'dropdown' ? (
                          <select
                            id={field.id}
                            required={field.required}
                            value={formData[fieldKey] || ''}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, [fieldKey]: e.target.value }))
                            }
                            className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm border border-slate-300 bg-white/95 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">{field.placeholder || 'Select an option'}</option>
                            {(field.options || []).map((opt: string, i: number) => (
                              <option key={i} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : field.type === 'radio' ? (
                          <div className="space-y-2 pt-1">
                            {(field.options || ['Yes', 'No']).map((opt: string, i: number) => (
                              <label
                                key={i}
                                className="flex items-center gap-2.5 text-xs sm:text-sm cursor-pointer"
                                style={{ color: textColor }}
                              >
                                <input
                                  type="radio"
                                  name={field.id}
                                  value={opt}
                                  checked={formData[fieldKey] === opt}
                                  onChange={(e) =>
                                    setFormData((prev) => ({ ...prev, [fieldKey]: e.target.value }))
                                  }
                                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                />
                                <span>{opt}</span>
                              </label>
                            ))}
                          </div>
                        ) : field.type === 'checkbox' ? (
                          <div className="space-y-2 pt-1">
                            {(field.options || ['I agree', 'Receive updates']).map((opt: string, i: number) => {
                              const selected: string[] = Array.isArray(formData[fieldKey])
                                ? formData[fieldKey]
                                : [];
                              const isChecked = selected.includes(opt);
                              return (
                                <label
                                  key={i}
                                  className="flex items-center gap-2.5 text-xs sm:text-sm cursor-pointer"
                                  style={{ color: textColor }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      const next = isChecked
                                        ? selected.filter((x) => x !== opt)
                                        : [...selected, opt];
                                      setFormData((prev) => ({ ...prev, [fieldKey]: next }));
                                    }}
                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                  />
                                  <span>{opt}</span>
                                </label>
                              );
                            })}
                          </div>
                        ) : field.type === 'consent' ? (
                          <label
                            className="flex items-start gap-2.5 text-xs cursor-pointer pt-1"
                            style={{ color: textColor }}
                          >
                            <input
                              type="checkbox"
                              required={field.required}
                              checked={!!formData[fieldKey]}
                              onChange={(e) =>
                                setFormData((prev) => ({ ...prev, [fieldKey]: e.target.checked }))
                              }
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 mt-0.5"
                            />
                            <span>{field.placeholder || 'I agree to the privacy policy and terms of service.'}</span>
                          </label>
                        ) : field.type === 'date' ? (
                          <input
                            id={field.id}
                            type="date"
                            required={field.required}
                            value={formData[fieldKey] || ''}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, [fieldKey]: e.target.value }))
                            }
                            className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm border border-slate-300 bg-white/95 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          <input
                            id={field.id}
                            type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : field.type === 'website' ? 'url' : 'text'}
                            required={field.required}
                            placeholder={field.placeholder}
                            value={formData[fieldKey] || ''}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, [fieldKey]: e.target.value }))
                            }
                            className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm border border-slate-300 bg-white/95 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={submitting}
                style={{
                  backgroundColor: customize.matchButton !== false ? highlightColor : '#2563EB',
                  color: '#FFFFFF',
                }}
                className="w-full py-3.5 rounded-2xl font-bold text-sm shadow-md hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? 'Submitting...' : buttonText}
              </button>
            </div>
          </form>
        )}

        {/* Footer */}
        <div className="py-3 px-6 bg-slate-50 border-t border-slate-200/60 text-center">
          <p className="text-[11px] text-slate-400">
            Powered by <span className="font-semibold text-slate-600">Leadzam CRM</span> · Secure Lead Capture
          </p>
        </div>
      </div>
    </div>
  );
}
