'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Undo2,
  Redo2,
  Pencil,
  Sparkles,
  Search,
  User,
  Mail,
  Phone,
  Globe,
  Type,
  AlignLeft,
  Hash,
  MapPin,
  ChevronDown,
  ListFilter,
  CheckSquare,
  CircleDot,
  Calendar,
  ShieldCheck,
  UploadCloud,
  GripVertical,
  Copy,
  Trash2,
  Plus,
  ChevronUp,
  Lock,
  Laptop,
  Tablet,
  Smartphone,
  Eye,
  Save,
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle2,
  Sliders,
  GitFork,
  Database,
  HelpCircle,
  X,
  FileText,
  AlertCircle,
  ExternalLink,
  ChevronUpCircle,
  ChevronDownCircle,
  Users,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/api';

// Field definition interface
export interface FormField {
  id: string;
  type: string;
  label: string;
  placeholder?: string;
  helpText?: string;
  required?: boolean;
  isLeadCapture?: boolean;
  options?: string[];
  countryCode?: string;
  defaultValue?: string;
}

export interface FormSection {
  id: string;
  title: string;
  description: string;
  collapsed?: boolean;
  fields: FormField[];
}

export interface FormSettings {
  successMessage: string;
  redirectUrl: string;
  requireEmailVerification: boolean;
  isActive: boolean;
  assignedAgentId?: string; // empty means Round-Robin
  conditionalRules: Array<{
    id: string;
    fieldId: string;
    operator: string;
    value: string;
    action: string;
    targetFieldId: string;
  }>;
  crmMapping: Record<string, string>;
}

export interface ThemePreset {
  name: string;
  primary: string;
  secondary: string;
  bg: string;
  text: string;
  cardBg: string;
}

const THEME_PRESETS: ThemePreset[] = [
  { name: 'Ocean Breeze', primary: '#0284c7', secondary: '#38bdf8', bg: '#f0f9ff', text: '#0f172a', cardBg: '#ffffff' },
  { name: 'Sunset Glow', primary: '#ea580c', secondary: '#fb923c', bg: '#fff7ed', text: '#0f172a', cardBg: '#ffffff' },
  { name: 'Forest Deep', primary: '#15803d', secondary: '#4ade80', bg: '#f0fdf4', text: '#0f172a', cardBg: '#ffffff' },
  { name: 'Royal Purple', primary: '#7e22ce', secondary: '#c084fc', bg: '#faf5ff', text: '#0f172a', cardBg: '#ffffff' },
  { name: 'Midnight Blue', primary: '#1e3a8a', secondary: '#60a5fa', bg: '#eff6ff', text: '#0f172a', cardBg: '#ffffff' },
  { name: 'Rose Gold', primary: '#be185d', secondary: '#f472b6', bg: '#fdf2f8', text: '#0f172a', cardBg: '#ffffff' },
  { name: 'Emerald Luxury', primary: '#047857', secondary: '#34d399', bg: '#ecfdf5', text: '#0f172a', cardBg: '#ffffff' },
  { name: 'Sapphire Sky', primary: '#0369a1', secondary: '#7dd3fc', bg: '#f0f9ff', text: '#0f172a', cardBg: '#ffffff' },
  { name: 'Amber Glow', primary: '#b45309', secondary: '#fbbf24', bg: '#fffbeb', text: '#0f172a', cardBg: '#ffffff' },
  { name: 'Slate Modern', primary: '#334155', secondary: '#94a3b8', bg: '#f8fafc', text: '#0f172a', cardBg: '#ffffff' },
  { name: 'Coral Reef', primary: '#e11d48', secondary: '#fb7185', bg: '#fff1f2', text: '#0f172a', cardBg: '#ffffff' },
  { name: 'Lavender Dream', primary: '#6d28d9', secondary: '#a78bfa', bg: '#f5f3ff', text: '#0f172a', cardBg: '#ffffff' },
];

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

export interface FormCustomize {
  themePreset: string;
  activeSubTab: 'Theme' | 'Header' | 'Sections' | 'Button';
  themeMode: 'light' | 'dark';
  bgColor: string;
  textColor: string;
  highlightColor: string;
  matchButton: boolean;
  buttonText: string;
  borderRadius: 'rounded-none' | 'rounded-xl' | 'rounded-3xl';
}

const PALETTE_CATEGORIES = [
  {
    category: 'CONTACT',
    items: [
      { type: 'fullName', label: 'Full Name', placeholder: 'Enter your full name', icon: User },
      { type: 'email', label: 'Email Address', placeholder: 'Enter your email address', icon: Mail },
      { type: 'phone', label: 'Phone Number', placeholder: 'Enter your phone number', icon: Phone },
      { type: 'website', label: 'Website URL', placeholder: 'https://example.com', icon: Globe },
    ],
  },
  {
    category: 'TEXT FIELDS',
    items: [
      { type: 'shortText', label: 'Short Text', placeholder: 'Type here...', icon: Type },
      { type: 'longText', label: 'Long Text', placeholder: 'Enter detailed message...', icon: AlignLeft },
    ],
  },
  {
    category: 'NUMBER',
    items: [
      { type: 'number', label: 'Number', placeholder: 'e.g. 100', icon: Hash },
    ],
  },
  {
    category: 'LOCATION',
    items: [
      { type: 'location', label: 'Location Widget', placeholder: 'City, State or Address', icon: MapPin },
    ],
  },
  {
    category: 'CHOICES',
    items: [
      { type: 'dropdown', label: 'Dropdown Menu', placeholder: 'Select an option', icon: ChevronDown, options: ['Option 1', 'Option 2', 'Option 3'] },
      { type: 'multiSelect', label: 'Multi-Select', placeholder: 'Select one or more', icon: ListFilter, options: ['Option A', 'Option B', 'Option C'] },
      { type: 'checkbox', label: 'Checkboxes', placeholder: '', icon: CheckSquare, options: ['I agree to terms', 'Subscribe to updates'] },
      { type: 'radio', label: 'Radio Buttons', placeholder: '', icon: CircleDot, options: ['Yes', 'No'] },
    ],
  },
  {
    category: 'DATE',
    items: [
      { type: 'date', label: 'Date Picker', placeholder: 'Select date', icon: Calendar },
    ],
  },
  {
    category: 'LEGAL',
    items: [
      { type: 'consent', label: 'Consent', placeholder: 'I agree to terms and privacy policy', icon: ShieldCheck },
    ],
  },
  {
    category: 'COMING SOON',
    items: [
      { type: 'file', label: 'File Upload', placeholder: 'Upload files (PDF, PNG up to 10MB)', icon: UploadCloud, comingSoon: true },
    ],
  },
];

export default function FormBuilderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const formId = searchParams.get('id');

  // Navigation state
  const [activeTab, setActiveTab] = useState<'Build' | 'Settings' | 'Customize'>('Build');
  const [settingsSubNav, setSettingsSubNav] = useState<'behavior' | 'conditional' | 'crm'>('behavior');
  const [customizeSubTab, setCustomizeSubTab] = useState<'Theme' | 'Header' | 'Sections' | 'Button'>('Theme');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  // Team members for lead assignment
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  // Form core state
  const [formName, setFormName] = useState('Unnamed Form');
  const [formCode, setFormCode] = useState('F-2');
  const [formDescription, setFormDescription] = useState('TESTING FORM');
  const [formTitle, setFormTitle] = useState('Untitled Form');
  const [formHeaderDesc, setFormHeaderDesc] = useState('Add a description for your form (optional)');
  const [slug, setSlug] = useState('unnamed-form');

  // Notification banner state
  const [showBanner, setShowBanner] = useState(true);

  // Field search filter
  const [fieldSearch, setFieldSearch] = useState('');

  // Editing state for form name
  const [isEditingName, setIsEditingName] = useState(false);

  // Active section & fields state
  const [sections, setSections] = useState<FormSection[]>([
    {
      id: 'section-1',
      title: 'Contact Information',
      description: 'We need your basic information to keep you updated about your inquiry.',
      collapsed: false,
      fields: [
        { id: 'f-name', type: 'fullName', label: 'Full Name', placeholder: 'Enter your full name', required: false },
        { id: 'f-email', type: 'email', label: 'Email Address', placeholder: 'Enter your email address', required: false },
        { id: 'f-phone', type: 'phone', label: 'Phone Number', placeholder: 'Enter your phone number', required: true, isLeadCapture: true, countryCode: '+91' },
      ],
    },
  ]);

  // Selected field for property inspector / inline modal
  const [editingField, setEditingField] = useState<FormField | null>(null);

  // Settings state
  const [settings, setSettings] = useState<FormSettings>({
    successMessage: "Thank you for getting in touch! We've received your inquiry and our team will connect with you within 15 minutes.",
    redirectUrl: '',
    requireEmailVerification: false,
    isActive: true,
    assignedAgentId: '',
    conditionalRules: [],
    crmMapping: {
      'f-name': 'fullName',
      'f-email': 'email',
      'f-phone': 'phone',
    },
  });

  // Customize state
  const [customize, setCustomize] = useState<FormCustomize>({
    themePreset: 'Ocean Breeze',
    activeSubTab: 'Theme',
    themeMode: 'light',
    bgColor: '#FFFFFF',
    textColor: '#1E293B',
    highlightColor: '#0284c7',
    matchButton: true,
    buttonText: 'Submit Inquiry',
    borderRadius: 'rounded-xl',
  });

  // Undo / Redo history
  const [history, setHistory] = useState<FormSection[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Saving state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Load team members
  useEffect(() => {
    async function loadTeam() {
      try {
        const res = await fetchWithAuth('/team');
        if (res?.members) {
          setTeamMembers(res.members);
        }
      } catch (e) {
        console.error('Failed to load team', e);
      }
    }
    loadTeam();
  }, []);

  // Fetch existing form if editing
  useEffect(() => {
    if (!formId) return;

    async function loadForm() {
      try {
        const res = await fetchWithAuth(`/forms/${formId}`);
        if (res?.form) {
          const f = res.form;
          setFormName(f.name || 'Untitled Form');
          setFormCode(f.formCode || 'F-1');
          setFormDescription(f.description || '');
          setSlug(f.slug || '');

          if (f.fieldsJson) {
            try {
              const parsed = JSON.parse(f.fieldsJson);
              if (Array.isArray(parsed)) {
                if (parsed.length > 0 && parsed[0].fields) {
                  setSections(parsed);
                } else {
                  setSections([
                    {
                      id: 'section-1',
                      title: 'Contact Information',
                      description: 'We need your basic information to keep you updated about your inquiry.',
                      collapsed: false,
                      fields: parsed,
                    },
                  ]);
                }
              }
            } catch (err) {}
          }

          if (f.settingsJson) {
            try {
              setSettings((prev) => ({ ...prev, ...JSON.parse(f.settingsJson) }));
            } catch (err) {}
          }

          if (f.customizeJson) {
            try {
              setCustomize((prev) => ({ ...prev, ...JSON.parse(f.customizeJson) }));
            } catch (err) {}
          }
        }
      } catch (e) {
        console.error('Failed to load form details', e);
      }
    }

    loadForm();
  }, [formId]);

  // Push to history when sections change
  const updateSectionsWithHistory = (newSections: FormSection[]) => {
    setHistory((prev) => [...prev.slice(0, historyIndex + 1), sections]);
    setHistoryIndex((prev) => prev + 1);
    setSections(newSections);
  };

  const handleUndo = () => {
    if (historyIndex >= 0) {
      const prev = history[historyIndex];
      setHistoryIndex((idx) => idx - 1);
      setSections(prev);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setHistoryIndex((idx) => idx + 1);
      setSections(next);
    }
  };

  // Add field from left palette to active or first section
  const handleAddField = (fieldItem: any) => {
    if (fieldItem.comingSoon) return;

    const newField: FormField = {
      id: `f-${Date.now().toString().slice(-4)}`,
      type: fieldItem.type,
      label: fieldItem.label,
      placeholder: fieldItem.placeholder,
      required: false,
      options: fieldItem.options ? [...fieldItem.options] : undefined,
      countryCode: fieldItem.type === 'phone' ? '+91' : undefined,
    };

    const newSections = [...sections];
    if (newSections.length === 0) {
      newSections.push({
        id: `section-${Date.now()}`,
        title: 'New Section',
        description: 'Fill in your details below.',
        collapsed: false,
        fields: [newField],
      });
    } else {
      newSections[newSections.length - 1].fields.push(newField);
    }
    updateSectionsWithHistory(newSections);
  };

  // Move a field up or down
  const handleMoveField = (sectionIdx: number, fieldIdx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? fieldIdx - 1 : fieldIdx + 1;
    if (targetIdx < 0 || targetIdx >= sections[sectionIdx].fields.length) return;

    const newSections = [...sections];
    const fields = [...newSections[sectionIdx].fields];
    const [moved] = fields.splice(fieldIdx, 1);
    fields.splice(targetIdx, 0, moved);
    newSections[sectionIdx].fields = fields;
    updateSectionsWithHistory(newSections);
  };

  // Move a section up or down
  const handleMoveSection = (sectionIdx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? sectionIdx - 1 : sectionIdx + 1;
    if (targetIdx < 0 || targetIdx >= sections.length) return;

    const newSections = [...sections];
    const [moved] = newSections.splice(sectionIdx, 1);
    newSections.splice(targetIdx, 0, moved);
    updateSectionsWithHistory(newSections);
  };

  // Duplicate a field
  const handleDuplicateField = (sectionIdx: number, fieldIdx: number) => {
    const target = sections[sectionIdx].fields[fieldIdx];
    const clone: FormField = {
      ...target,
      id: `f-${Date.now().toString().slice(-4)}`,
      label: `${target.label} (Copy)`,
      isLeadCapture: false,
    };
    const newSections = [...sections];
    newSections[sectionIdx].fields.splice(fieldIdx + 1, 0, clone);
    updateSectionsWithHistory(newSections);
  };

  // Delete a field
  const handleDeleteField = (sectionIdx: number, fieldIdx: number) => {
    const target = sections[sectionIdx].fields[fieldIdx];
    if (target.isLeadCapture) {
      alert('Phone number is required to capture leads and cannot be removed.');
      return;
    }
    const newSections = [...sections];
    newSections[sectionIdx].fields.splice(fieldIdx, 1);
    updateSectionsWithHistory(newSections);
  };

  // Add new Section
  const handleAddSection = () => {
    const newSection: FormSection = {
      id: `section-${Date.now()}`,
      title: `Section ${sections.length + 1}`,
      description: 'Add section instructions or details.',
      collapsed: false,
      fields: [],
    };
    updateSectionsWithHistory([...sections, newSection]);
  };

  // Duplicate a section
  const handleDuplicateSection = (sectionIdx: number) => {
    const target = sections[sectionIdx];
    const clone: FormSection = {
      ...target,
      id: `section-${Date.now()}`,
      title: `${target.title} (Copy)`,
      fields: target.fields.map((f) => ({
        ...f,
        id: `f-${Date.now().toString().slice(-4)}-${Math.random().toString().slice(2, 5)}`,
        isLeadCapture: false,
      })),
    };
    const newSections = [...sections];
    newSections.splice(sectionIdx + 1, 0, clone);
    updateSectionsWithHistory(newSections);
  };

  // Delete a section
  const handleDeleteSection = (sectionIdx: number) => {
    if (sections.length <= 1) {
      alert('Forms require at least one section.');
      return;
    }
    const hasLeadCapture = sections[sectionIdx].fields.some((f) => f.isLeadCapture);
    if (hasLeadCapture) {
      alert('This section contains the required Lead Capture phone field. Please move it before deleting.');
      return;
    }
    const newSections = sections.filter((_, idx) => idx !== sectionIdx);
    updateSectionsWithHistory(newSections);
  };

  // Select a theme preset
  const handleSelectThemePreset = (preset: ThemePreset) => {
    setCustomize((prev) => ({
      ...prev,
      themePreset: preset.name,
      highlightColor: preset.primary,
      bgColor: customize.themeMode === 'dark' ? '#0f172a' : preset.cardBg,
      textColor: customize.themeMode === 'dark' ? '#f8fafc' : preset.text,
    }));
  };

  // Save the form
  const handleSaveForm = async () => {
    try {
      setIsSaving(true);
      setSaveSuccessMsg('');

      // Check that at least one phone field is present
      const allFields = sections.flatMap((s) => s.fields);
      const hasPhone = allFields.some((f) => f.type === 'phone' || f.isLeadCapture);
      if (!hasPhone) {
        alert('Validation Error: Form must include at least one Phone field to capture leads.');
        setIsSaving(false);
        return;
      }

      const payload = {
        name: formName || 'Untitled Form',
        description: formDescription,
        fieldsJson: JSON.stringify(sections),
        sectionsCount: sections.length,
        settingsJson: JSON.stringify(settings),
        customizeJson: JSON.stringify(customize),
        status: settings.isActive ? 'ACTIVE' : 'INACTIVE',
      };

      if (formId) {
        await fetchWithAuth(`/forms/${formId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await fetchWithAuth('/forms', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setSaveSuccessMsg('Form saved successfully!');
      setTimeout(() => {
        router.push('/dashboard/forms');
      }, 700);
    } catch (err: any) {
      console.error('Failed to save form', err);
      alert(err.message || 'Error saving form. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Compute total counts
  const totalSections = sections.length;
  const totalFields = sections.reduce((acc, s) => acc + s.fields.length, 0);

  // Filter left palette items based on search
  const filteredPalette = PALETTE_CATEGORIES.map((cat) => {
    const items = cat.items.filter((item) =>
      item.label.toLowerCase().includes(fieldSearch.toLowerCase()) ||
      cat.category.toLowerCase().includes(fieldSearch.toLowerCase())
    );
    return { ...cat, items };
  }).filter((cat) => cat.items.length > 0);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800">
      {/* Top Header Bar */}
      <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-40 shadow-xs">
        {/* Left: Form Name & Code */}
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/forms"
            className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-lg hover:bg-slate-100"
            title="Back to Forms"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            {isEditingName ? (
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                onBlur={() => setIsEditingName(false)}
                onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
                autoFocus
                className="text-lg font-bold text-slate-900 border-b-2 border-blue-600 outline-none px-1 bg-transparent"
              />
            ) : (
              <div
                onClick={() => setIsEditingName(true)}
                className="flex items-center gap-2 cursor-pointer group hover:bg-slate-50 py-1 px-2 rounded-lg transition-colors"
              >
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">{formName}</h1>
                <span className="text-xs bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-md border border-slate-200">
                  {formCode}
                </span>
                <Pencil className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition-colors" />
              </div>
            )}
          </div>
        </div>

        {/* Center: 3-Tab Pill Switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('Build')}
            className={`flex items-center gap-2 px-5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'Build'
                ? 'bg-white text-blue-600 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            Build
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('Settings')}
            className={`flex items-center gap-2 px-5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'Settings'
                ? 'bg-white text-blue-600 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-4 h-4" />
            Settings
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('Customize')}
            className={`flex items-center gap-2 px-5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'Customize'
                ? 'bg-white text-blue-600 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Customize
          </button>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-3">
          {slug && (
            <a
              href={`/forms/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 rounded-lg transition-colors"
              title="Test Live Form"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Live Form</span>
            </a>
          )}

          <button
            type="button"
            onClick={() => router.push('/dashboard/forms')}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>

          {activeTab !== 'Customize' ? (
            <button
              type="button"
              onClick={() => {
                if (activeTab === 'Build') setActiveTab('Settings');
                else if (activeTab === 'Settings') setActiveTab('Customize');
              }}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSaveForm}
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Form'}
            </button>
          )}
        </div>
      </header>

      {/* Save Success Toast */}
      {saveSuccessMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-fade-in">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-medium text-sm">{saveSuccessMsg}</span>
        </div>
      )}

      {/* Main Content Area based on Tab */}
      <div className="flex-1 flex overflow-hidden">
        {/* ========================================================= */}
        {/* TAB 1: BUILD (Screenshot 2 & 3)                           */}
        {/* ========================================================= */}
        {activeTab === 'Build' && (
          <div className="flex-1 flex w-full h-[calc(100vh-4rem)]">
            {/* Left Sidebar: FORM FIELDS Palette */}
            <div className="w-72 bg-white border-r border-slate-200 flex flex-col h-full overflow-hidden shrink-0">
              <div className="p-4 border-b border-slate-100">
                <h2 className="text-xs font-bold text-slate-700 tracking-wider uppercase mb-3">
                  Form Fields
                </h2>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={fieldSearch}
                    onChange={(e) => setFieldSearch(e.target.value)}
                    placeholder="Search fields"
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Categorized Field Tiles */}
              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {filteredPalette.map((catGroup) => (
                  <div key={catGroup.category}>
                    <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-2">
                      {catGroup.category}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {catGroup.items.map((item) => {
                        const Icon = item.icon;
                        const isComingSoon = (item as any).comingSoon;
                        return (
                          <button
                            key={item.type}
                            type="button"
                            onClick={() => handleAddField(item)}
                            disabled={isComingSoon}
                            className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                              isComingSoon
                                ? 'border-dashed border-slate-200 bg-slate-50/50 text-slate-300 cursor-not-allowed'
                                : 'border-slate-200 bg-white hover:border-blue-400 hover:shadow-xs hover:text-blue-600 text-slate-700 cursor-pointer active:scale-95'
                            }`}
                          >
                            <Icon className={`w-5 h-5 mb-1.5 ${isComingSoon ? 'text-slate-300' : 'text-blue-500'}`} />
                            <span className="text-xs font-medium leading-tight">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Center Canvas Area */}
            <div className="flex-1 overflow-y-auto bg-slate-100/60 p-6 flex flex-col items-center">
              {/* Top Notification Banner */}
              {showBanner && (
                <div className="w-full max-w-2xl bg-amber-50/80 border border-amber-200/80 text-amber-900 px-4 py-2.5 rounded-xl mb-4 flex items-center justify-between text-xs font-medium shadow-xs">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>First section created — Phone is required to capture leads</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBanner(false)}
                    className="text-amber-500 hover:text-amber-700 p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Canvas Controls Header */}
              <div className="w-full max-w-2xl flex items-center justify-between mb-4">
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-xs">
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={historyIndex < 0}
                    title="Undo"
                    className="p-1.5 text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed rounded"
                  >
                    <Undo2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleRedo}
                    disabled={historyIndex >= history.length - 1}
                    title="Redo"
                    className="p-1.5 text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed rounded"
                  >
                    <Redo2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-xs font-medium text-slate-500">
                  {totalSections} {totalSections === 1 ? 'section' : 'sections'} · {totalFields}{' '}
                  {totalFields === 1 ? 'field' : 'fields'}
                </div>
              </div>

              {/* Form Canvas Paper */}
              <div className="w-full max-w-2xl space-y-4 pb-16">
                {/* Form Header Card */}
                <div className="bg-white rounded-2xl border-t-4 border-t-blue-600 border border-slate-200 shadow-sm p-6 text-center">
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Untitled Form"
                    className="text-2xl font-bold text-slate-900 text-center w-full outline-none focus:border-b border-blue-400 pb-1"
                  />
                  <input
                    type="text"
                    value={formHeaderDesc}
                    onChange={(e) => setFormHeaderDesc(e.target.value)}
                    placeholder="Add a description for your form (optional)"
                    className="text-sm text-slate-500 text-center w-full outline-none focus:border-b border-slate-300 mt-2"
                  />
                </div>

                {/* Form Sections */}
                {sections.map((section, sIdx) => (
                  <div
                    key={section.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all"
                  >
                    {/* Section Header */}
                    <div className="p-5 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
                      <div className="flex-1 mr-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const newSections = [...sections];
                              newSections[sIdx].collapsed = !newSections[sIdx].collapsed;
                              setSections(newSections);
                            }}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            {section.collapsed ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronUp className="w-4 h-4" />
                            )}
                          </button>
                          <input
                            type="text"
                            value={section.title}
                            onChange={(e) => {
                              const newSections = [...sections];
                              newSections[sIdx].title = e.target.value;
                              setSections(newSections);
                            }}
                            className="font-bold text-base text-slate-900 bg-transparent outline-none focus:border-b border-blue-400"
                          />
                        </div>
                        <input
                          type="text"
                          value={section.description}
                          onChange={(e) => {
                            const newSections = [...sections];
                            newSections[sIdx].description = e.target.value;
                            setSections(newSections);
                          }}
                          placeholder="Section description..."
                          className="text-xs text-slate-500 bg-transparent outline-none focus:border-b border-slate-300 mt-1 w-full pl-6"
                        />
                      </div>

                      {/* Section Action Icons (Move up/down, duplicate, delete) */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveSection(sIdx, 'up')}
                          disabled={sIdx === 0}
                          title="Move section up"
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg disabled:opacity-30"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveSection(sIdx, 'down')}
                          disabled={sIdx === sections.length - 1}
                          title="Move section down"
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg disabled:opacity-30"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicateSection(sIdx)}
                          title="Duplicate section"
                          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSection(sIdx)}
                          title="Delete section"
                          disabled={sections.length <= 1}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Section Fields Body */}
                    {!section.collapsed && (
                      <div className="p-5 space-y-4">
                        {section.fields.map((field, fIdx) => {
                          const isLeadCapturePhone = field.isLeadCapture || field.type === 'phone';
                          return (
                            <div
                              key={field.id}
                              onClick={() => setEditingField(field)}
                              className={`p-4 rounded-xl border transition-all cursor-pointer group ${
                                editingField?.id === field.id
                                  ? 'border-blue-500 ring-2 ring-blue-100 bg-blue-50/20'
                                  : 'border-slate-200 bg-white hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                  <label className="text-sm font-semibold text-slate-800">
                                    {field.label}
                                  </label>
                                  {field.required && <span className="text-red-500 font-bold">*</span>}
                                  {isLeadCapturePhone && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200">
                                      <Lock className="w-2.5 h-2.5" />
                                      Lead Capture
                                    </span>
                                  )}
                                </div>

                                {/* Field Action Icons (Move up/down, duplicate, delete) */}
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMoveField(sIdx, fIdx, 'up');
                                    }}
                                    disabled={fIdx === 0}
                                    title="Move up"
                                    className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 disabled:opacity-20"
                                  >
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMoveField(sIdx, fIdx, 'down');
                                    }}
                                    disabled={fIdx === section.fields.length - 1}
                                    title="Move down"
                                    className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 disabled:opacity-20"
                                  >
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDuplicateField(sIdx, fIdx);
                                    }}
                                    title="Duplicate field"
                                    className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                  {!field.isLeadCapture && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteField(sIdx, fIdx);
                                      }}
                                      title="Delete field"
                                      className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Input Preview according to Field Type */}
                              {isLeadCapturePhone ? (
                                <div>
                                  <div className="flex items-center gap-2">
                                    <select
                                      value={field.countryCode || '+91'}
                                      onChange={(e) => {
                                        const updated = { ...field, countryCode: e.target.value };
                                        const newSections = sections.map((s) => ({
                                          ...s,
                                          fields: s.fields.map((f) => (f.id === updated.id ? updated : f)),
                                        }));
                                        setSections(newSections);
                                      }}
                                      className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none"
                                    >
                                      {COUNTRY_CODES.map((c) => (
                                        <option key={c.code} value={c.code}>
                                          {c.flag} {c.code}
                                        </option>
                                      ))}
                                    </select>
                                    <input
                                      type="text"
                                      placeholder={field.placeholder || 'Enter your phone number'}
                                      disabled
                                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 cursor-not-allowed"
                                    />
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-400 font-medium">
                                    <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span>
                                      Phone is required to capture and de-duplicate leads. You can rename it, but it
                                      can't be removed.
                                    </span>
                                  </div>
                                </div>
                              ) : field.type === 'longText' ? (
                                <textarea
                                  placeholder={field.placeholder}
                                  disabled
                                  rows={2}
                                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 cursor-not-allowed resize-none"
                                />
                              ) : field.type === 'dropdown' ? (
                                <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500">
                                  <span>{field.placeholder || 'Select an option'}</span>
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </div>
                              ) : field.type === 'radio' ? (
                                <div className="space-y-1.5 pt-1">
                                  {(field.options || ['Yes', 'No']).map((opt, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                                      <input type="radio" disabled checked={i === 0} />
                                      <span>{opt}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : field.type === 'checkbox' ? (
                                <div className="space-y-1.5 pt-1">
                                  {(field.options || ['Option A', 'Option B']).map((opt, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                                      <input type="checkbox" disabled checked={i === 0} />
                                      <span>{opt}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : field.type === 'consent' ? (
                                <div className="flex items-center gap-2 text-xs text-slate-600 pt-1">
                                  <input type="checkbox" disabled checked />
                                  <span>{field.placeholder || 'I agree to the terms and privacy policy'}</span>
                                </div>
                              ) : field.type === 'date' ? (
                                <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500">
                                  <span>YYYY-MM-DD</span>
                                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                </div>
                              ) : (
                                <input
                                  type="text"
                                  placeholder={field.placeholder}
                                  disabled
                                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 cursor-not-allowed"
                                />
                              )}
                            </div>
                          );
                        })}

                        {section.fields.length === 0 && (
                          <div className="p-8 border-2 border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
                            Click any field in the left palette to add it here.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Add Section Button */}
                <button
                  type="button"
                  onClick={handleAddSection}
                  className="w-full py-3 border-2 border-dashed border-slate-300 hover:border-blue-400 bg-white hover:bg-blue-50/40 text-slate-600 hover:text-blue-600 rounded-2xl font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  + Add section
                </button>
              </div>
            </div>

            {/* Field Property Modal / Drawer when editing a field */}
            {editingField && (
              <div className="w-80 bg-white border-l border-slate-200 p-5 flex flex-col h-full overflow-y-auto">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Edit Field Properties
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEditingField(null)}
                    className="p-1 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Field Label
                    </label>
                    <input
                      type="text"
                      value={editingField.label}
                      onChange={(e) => {
                        const updated = { ...editingField, label: e.target.value };
                        setEditingField(updated);
                        const newSections = sections.map((s) => ({
                          ...s,
                          fields: s.fields.map((f) => (f.id === updated.id ? updated : f)),
                        }));
                        setSections(newSections);
                      }}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Placeholder Text
                    </label>
                    <input
                      type="text"
                      value={editingField.placeholder || ''}
                      onChange={(e) => {
                        const updated = { ...editingField, placeholder: e.target.value };
                        setEditingField(updated);
                        const newSections = sections.map((s) => ({
                          ...s,
                          fields: s.fields.map((f) => (f.id === updated.id ? updated : f)),
                        }));
                        setSections(newSections);
                      }}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-xs font-semibold text-slate-700">Required Field</span>
                    <button
                      type="button"
                      disabled={editingField.isLeadCapture}
                      onClick={() => {
                        const updated = { ...editingField, required: !editingField.required };
                        setEditingField(updated);
                        const newSections = sections.map((s) => ({
                          ...s,
                          fields: s.fields.map((f) => (f.id === updated.id ? updated : f)),
                        }));
                        setSections(newSections);
                      }}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        editingField.required ? 'bg-blue-600' : 'bg-slate-200'
                      } ${editingField.isLeadCapture ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                          editingField.required ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {editingField.options && (
                    <div className="pt-2 border-t border-slate-100">
                      <label className="text-xs font-semibold text-slate-700 block mb-2">
                        Options (Choices)
                      </label>
                      <div className="space-y-2">
                        {editingField.options.map((opt, optIdx) => (
                          <div key={optIdx} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => {
                                const newOpts = [...(editingField.options || [])];
                                newOpts[optIdx] = e.target.value;
                                const updated = { ...editingField, options: newOpts };
                                setEditingField(updated);
                                const newSections = sections.map((s) => ({
                                  ...s,
                                  fields: s.fields.map((f) => (f.id === updated.id ? updated : f)),
                                }));
                                setSections(newSections);
                              }}
                              className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newOpts = editingField.options?.filter((_, i) => i !== optIdx);
                                const updated = { ...editingField, options: newOpts };
                                setEditingField(updated);
                                const newSections = sections.map((s) => ({
                                  ...s,
                                  fields: s.fields.map((f) => (f.id === updated.id ? updated : f)),
                                }));
                                setSections(newSections);
                              }}
                              className="text-slate-400 hover:text-red-500"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            const newOpts = [...(editingField.options || []), `Option ${editingField.options!.length + 1}`];
                            const updated = { ...editingField, options: newOpts };
                            setEditingField(updated);
                            const newSections = sections.map((s) => ({
                              ...s,
                              fields: s.fields.map((f) => (f.id === updated.id ? updated : f)),
                            }));
                            setSections(newSections);
                          }}
                          className="text-xs text-blue-600 font-medium hover:underline pt-1 block"
                        >
                          + Add Option
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-auto pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingField(null)}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: SETTINGS (Screenshots 4 & 5)                       */}
        {/* ========================================================= */}
        {activeTab === 'Settings' && (
          <div className="flex-1 flex w-full h-[calc(100vh-4rem)]">
            {/* Sub-Navigation Sidebar */}
            <div className="w-72 bg-white border-r border-slate-200 flex flex-col justify-between h-full p-4 shrink-0">
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setSettingsSubNav('behavior')}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all ${
                    settingsSubNav === 'behavior'
                      ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Sliders className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold">Form Behavior</div>
                    <div className="text-[11px] text-slate-500 font-normal">
                      Submission & verification
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSettingsSubNav('conditional')}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all ${
                    settingsSubNav === 'conditional'
                      ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <GitFork className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold">Conditional Fields</div>
                    <div className="text-[11px] text-slate-500 font-normal">Dynamic field logic</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSettingsSubNav('crm')}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all ${
                    settingsSubNav === 'crm'
                      ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Database className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold">CRM Mapping</div>
                    <div className="text-[11px] text-slate-500 font-normal">
                      Lead field integrations
                    </div>
                  </div>
                </button>
              </div>

              {/* Settings Overview Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Settings Overview
                </h4>
                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex items-center justify-between">
                    <span>Status:</span>
                    <span
                      className={`font-semibold ${
                        settings.isActive ? 'text-emerald-600' : 'text-slate-400'
                      }`}
                    >
                      {settings.isActive ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Lead Capture:</span>
                    <span className="font-semibold text-blue-600">Phone Locked</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Assignment:</span>
                    <span className="font-semibold text-slate-700">
                      {settings.assignedAgentId ? 'Specific Agent' : 'Round Robin'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Redirect URL:</span>
                    <span className="font-semibold text-slate-700 truncate max-w-[110px]">
                      {settings.redirectUrl ? 'Configured' : 'None'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Sub-Panel Content */}
            <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
              <div className="max-w-3xl space-y-6">
                {/* 1. Form Behavior */}
                {settingsSubNav === 'behavior' && (
                  <div className="space-y-6">
                    {/* Submission Behavior */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
                      <h3 className="text-sm font-bold text-slate-900 mb-4">Submission Behavior</h3>

                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-semibold text-slate-700 block mb-1">
                            Success Message
                          </label>
                          <textarea
                            rows={3}
                            value={settings.successMessage}
                            onChange={(e) =>
                              setSettings((prev) => ({ ...prev, successMessage: e.target.value }))
                            }
                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-500 resize-none text-slate-800"
                          />
                          <p className="text-[11px] text-slate-400 mt-1">
                            Shown to the visitor immediately after successful submission.
                          </p>
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-slate-700 block mb-1">
                            Redirect URL (Optional)
                          </label>
                          <input
                            type="url"
                            value={settings.redirectUrl}
                            onChange={(e) =>
                              setSettings((prev) => ({ ...prev, redirectUrl: e.target.value }))
                            }
                            placeholder="https://yourwebsite.com/thank-you"
                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-slate-800"
                          />
                          <p className="text-[11px] text-slate-400 mt-1">
                            Leave blank to show the success message on page, or redirect to a thank-you page.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Lead Assignment */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
                      <h3 className="text-sm font-bold text-slate-900 mb-4">Lead Assignment Strategy</h3>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          Assign Captured Leads To:
                        </label>
                        <select
                          value={settings.assignedAgentId || ''}
                          onChange={(e) =>
                            setSettings((prev) => ({ ...prev, assignedAgentId: e.target.value }))
                          }
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-500 bg-white"
                        >
                          <option value="">Automatic (Round Robin across available agents)</option>
                          {teamMembers.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.role}) {m.isOnLeave ? '[On Leave]' : ''}
                            </option>
                          ))}
                        </select>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Default is Round-Robin distribution which balances incoming leads equally across team members.
                        </p>
                      </div>
                    </div>

                    {/* Verification Settings */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
                      <h3 className="text-sm font-bold text-slate-900 mb-4">Verification Settings</h3>

                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-semibold text-slate-800">
                            Require email verification
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Send a 6-digit confirmation OTP to verify email authenticity before capturing.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setSettings((prev) => ({
                              ...prev,
                              requireEmailVerification: !prev.requireEmailVerification,
                            }))
                          }
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            settings.requireEmailVerification ? 'bg-blue-600' : 'bg-slate-200'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                              settings.requireEmailVerification ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Form Status */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
                      <h3 className="text-sm font-bold text-slate-900 mb-4">Form Status</h3>

                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-semibold text-slate-800">Active Form</div>
                          <div className="text-[11px] text-slate-400">
                            When active, this form accepts public submissions and pushes leads into the CRM.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setSettings((prev) => ({ ...prev, isActive: !prev.isActive }))
                          }
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            settings.isActive ? 'bg-emerald-600' : 'bg-slate-200'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                              settings.isActive ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Behavior Settings Tips Card */}
                    <div className="bg-blue-50/60 border border-blue-200 rounded-2xl p-5 flex items-start gap-3">
                      <Sparkles className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-blue-900 mb-1">
                          Behavior Settings Tips
                        </h4>
                        <p className="text-xs text-blue-800 leading-relaxed">
                          Every form submission immediately triggers your CRM Lead Distribution
                          Service. The assigned agent will receive an instant sync notification on
                          their Android Companion app.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Conditional Fields */}
                {settingsSubNav === 'conditional' && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Dynamic Conditional Rules</h3>
                        <p className="text-xs text-slate-500">
                          Show or hide fields dynamically depending on how the respondent answers previous questions.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const allF = sections.flatMap((s) => s.fields);
                          const newRule = {
                            id: `rule-${Date.now()}`,
                            fieldId: allF[0]?.id || '',
                            operator: 'equals',
                            value: '',
                            action: 'show',
                            targetFieldId: allF[1]?.id || '',
                          };
                          setSettings((prev) => ({
                            ...prev,
                            conditionalRules: [...prev.conditionalRules, newRule],
                          }));
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-semibold transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Rule
                      </button>
                    </div>

                    {settings.conditionalRules.length === 0 ? (
                      <div className="py-12 border-2 border-dashed border-slate-200 rounded-xl text-center">
                        <GitFork className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs text-slate-500 font-medium">No conditional rules configured yet.</p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Click "+ Add Rule" above to create smart branching logic.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {settings.conditionalRules.map((rule, rIdx) => (
                          <div
                            key={rule.id}
                            className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3 text-xs flex-wrap"
                          >
                            <span className="font-bold text-slate-500">IF</span>
                            <select
                              value={rule.fieldId}
                              onChange={(e) => {
                                const updated = [...settings.conditionalRules];
                                updated[rIdx].fieldId = e.target.value;
                                setSettings((prev) => ({ ...prev, conditionalRules: updated }));
                              }}
                              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-medium"
                            >
                              {sections.flatMap((s) => s.fields).map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.label}
                                </option>
                              ))}
                            </select>

                            <select
                              value={rule.operator}
                              onChange={(e) => {
                                const updated = [...settings.conditionalRules];
                                updated[rIdx].operator = e.target.value;
                                setSettings((prev) => ({ ...prev, conditionalRules: updated }));
                              }}
                              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg"
                            >
                              <option value="equals">Equals</option>
                              <option value="not_equals">Does not equal</option>
                              <option value="contains">Contains</option>
                              <option value="not_empty">Is not empty</option>
                            </select>

                            {rule.operator !== 'not_empty' && (
                              <input
                                type="text"
                                value={rule.value}
                                onChange={(e) => {
                                  const updated = [...settings.conditionalRules];
                                  updated[rIdx].value = e.target.value;
                                  setSettings((prev) => ({ ...prev, conditionalRules: updated }));
                                }}
                                placeholder="Value..."
                                className="w-32 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg outline-none"
                              />
                            )}

                            <span className="font-bold text-slate-500">THEN</span>

                            <select
                              value={rule.action}
                              onChange={(e) => {
                                const updated = [...settings.conditionalRules];
                                updated[rIdx].action = e.target.value;
                                setSettings((prev) => ({ ...prev, conditionalRules: updated }));
                              }}
                              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg"
                            >
                              <option value="show">SHOW</option>
                              <option value="hide">HIDE</option>
                            </select>

                            <select
                              value={rule.targetFieldId}
                              onChange={(e) => {
                                const updated = [...settings.conditionalRules];
                                updated[rIdx].targetFieldId = e.target.value;
                                setSettings((prev) => ({ ...prev, conditionalRules: updated }));
                              }}
                              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-medium"
                            >
                              {sections.flatMap((s) => s.fields).map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.label}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              onClick={() => {
                                const updated = settings.conditionalRules.filter((_, idx) => idx !== rIdx);
                                setSettings((prev) => ({ ...prev, conditionalRules: updated }));
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-500 ml-auto"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. CRM Mapping */}
                {settingsSubNav === 'crm' && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                    <h3 className="text-sm font-bold text-slate-900">CRM Lead Attribute Mapping</h3>
                    <p className="text-xs text-slate-500">
                      Map each field in this form to the corresponding Lead column in your CRM database.
                    </p>

                    <div className="divide-y divide-slate-100">
                      {sections.flatMap((s) => s.fields).map((field) => {
                        const isLockedPhone = field.isLeadCapture || field.type === 'phone';
                        return (
                          <div key={field.id} className="py-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-800">{field.label}</span>
                              <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                                {field.type}
                              </span>
                            </div>

                            <div className="flex items-center gap-3">
                              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                              {isLockedPhone ? (
                                <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 flex items-center gap-1.5">
                                  <Lock className="w-3 h-3" />
                                  Lead Phone (Primary Key)
                                </span>
                              ) : (
                                <select
                                  value={settings.crmMapping[field.id] || (field.type === 'fullName' ? 'fullName' : field.type === 'email' ? 'email' : 'custom')}
                                  onChange={(e) => {
                                    setSettings((prev) => ({
                                      ...prev,
                                      crmMapping: {
                                        ...prev.crmMapping,
                                        [field.id]: e.target.value,
                                      },
                                    }));
                                  }}
                                  className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none font-medium"
                                >
                                  <option value="fullName">Lead Name (fullName)</option>
                                  <option value="email">Email Address (email)</option>
                                  <option value="company">Company (company)</option>
                                  <option value="city">City (city)</option>
                                  <option value="state">State (state)</option>
                                  <option value="streetAddress">Address (streetAddress)</option>
                                  <option value="custom">Custom Field (customFields JSON)</option>
                                  <option value="tags">Tags</option>
                                </select>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: CUSTOMIZE (Screenshot 6)                           */}
        {/* ========================================================= */}
        {activeTab === 'Customize' && (
          <div className="flex-1 flex w-full h-[calc(100vh-4rem)]">
            {/* Left Customize Controls Panel */}
            <div className="w-96 bg-white border-r border-slate-200 flex flex-col h-full overflow-hidden shrink-0">
              {/* Customize Sub-Tabs */}
              <div className="flex border-b border-slate-200 px-4 pt-3 gap-6 text-xs font-semibold">
                {(['Theme', 'Header', 'Sections', 'Button'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setCustomizeSubTab(tab)}
                    className={`pb-2.5 transition-colors border-b-2 ${
                      customizeSubTab === tab
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Sub-Tab Content: Theme Presets & Palette */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {customizeSubTab === 'Theme' && (
                  <>
                    {/* 12 Theme Presets Grid */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                        Theme Presets
                      </h4>
                      <div className="grid grid-cols-2 gap-2.5">
                        {THEME_PRESETS.map((preset) => {
                          const isSelected = customize.themePreset === preset.name;
                          return (
                            <button
                              key={preset.name}
                              type="button"
                              onClick={() => handleSelectThemePreset(preset)}
                              className={`p-3 rounded-xl border text-left transition-all ${
                                isSelected
                                  ? 'border-blue-600 ring-2 ring-blue-100 bg-blue-50/20'
                                  : 'border-slate-200 hover:border-slate-300 bg-white'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-slate-800">
                                  {preset.name}
                                </span>
                                {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                              </div>
                              {/* Color Bar */}
                              <div className="h-2.5 rounded-full overflow-hidden flex shadow-2xs">
                                <div className="flex-1" style={{ backgroundColor: preset.primary }} />
                                <div className="flex-1" style={{ backgroundColor: preset.secondary }} />
                                <div className="flex-1" style={{ backgroundColor: preset.bg }} />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Base & Palette Controls */}
                    <div className="pt-4 border-t border-slate-100 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Base & Palette
                        </span>
                        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-medium">
                          <button
                            type="button"
                            onClick={() =>
                              setCustomize((prev) => ({
                                ...prev,
                                themeMode: 'light',
                                bgColor: '#FFFFFF',
                                textColor: '#1E293B',
                              }))
                            }
                            className={`px-2.5 py-1 rounded-md transition-all ${
                              customize.themeMode === 'light'
                                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                                : 'text-slate-500'
                            }`}
                          >
                            Light
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setCustomize((prev) => ({
                                ...prev,
                                themeMode: 'dark',
                                bgColor: '#0f172a',
                                textColor: '#f8fafc',
                              }))
                            }
                            className={`px-2.5 py-1 rounded-md transition-all ${
                              customize.themeMode === 'dark'
                                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                                : 'text-slate-500'
                            }`}
                          >
                            Dark
                          </button>
                        </div>
                      </div>

                      {/* Color Pickers */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-600">Background color</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={customize.bgColor}
                              onChange={(e) =>
                                setCustomize((prev) => ({ ...prev, bgColor: e.target.value }))
                              }
                              className="w-7 h-7 rounded border border-slate-200 cursor-pointer p-0.5"
                            />
                            <span className="text-xs font-mono text-slate-500 uppercase">
                              {customize.bgColor}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-600">Text color</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={customize.textColor}
                              onChange={(e) =>
                                setCustomize((prev) => ({ ...prev, textColor: e.target.value }))
                              }
                              className="w-7 h-7 rounded border border-slate-200 cursor-pointer p-0.5"
                            />
                            <span className="text-xs font-mono text-slate-500 uppercase">
                              {customize.textColor}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-600">Highlight color</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={customize.highlightColor}
                              onChange={(e) =>
                                setCustomize((prev) => ({ ...prev, highlightColor: e.target.value }))
                              }
                              className="w-7 h-7 rounded border border-slate-200 cursor-pointer p-0.5"
                            />
                            <span className="text-xs font-mono text-slate-500 uppercase">
                              {customize.highlightColor}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                          <span className="text-xs font-medium text-slate-600">Match button</span>
                          <button
                            type="button"
                            onClick={() =>
                              setCustomize((prev) => ({ ...prev, matchButton: !prev.matchButton }))
                            }
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              customize.matchButton ? 'bg-blue-600' : 'bg-slate-200'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                                customize.matchButton ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {customizeSubTab === 'Button' && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Submit Button Text
                      </label>
                      <input
                        type="text"
                        value={customize.buttonText}
                        onChange={(e) =>
                          setCustomize((prev) => ({ ...prev, buttonText: e.target.value }))
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}

                {customizeSubTab === 'Header' && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Form Heading Title
                      </label>
                      <input
                        type="text"
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Subtitle / Description
                      </label>
                      <input
                        type="text"
                        value={formHeaderDesc}
                        onChange={(e) => setFormHeaderDesc(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none"
                      />
                    </div>
                  </div>
                )}

                {customizeSubTab === 'Sections' && (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500 leading-relaxed">
                      All sections inherit the active theme colors. You can collapse or expand sections
                      and add helper descriptions for your visitors.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Live Preview Area */}
            <div className="flex-1 overflow-y-auto bg-slate-100/70 p-6 flex flex-col items-center justify-start">
              {/* Device Viewport Switcher */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-xs mb-6">
                <button
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    previewDevice === 'desktop'
                      ? 'bg-blue-50 text-blue-700 font-semibold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Laptop className="w-3.5 h-3.5" />
                  Desktop
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('tablet')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    previewDevice === 'tablet'
                      ? 'bg-blue-50 text-blue-700 font-semibold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Tablet className="w-3.5 h-3.5" />
                  Tablet
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('mobile')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    previewDevice === 'mobile'
                      ? 'bg-blue-50 text-blue-700 font-semibold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  Mobile
                </button>
              </div>

              {/* Viewport Frame */}
              <div
                className={`transition-all duration-300 w-full rounded-2xl shadow-xl overflow-hidden border border-slate-200/80 ${
                  previewDevice === 'desktop'
                    ? 'max-w-2xl'
                    : previewDevice === 'tablet'
                    ? 'max-w-md'
                    : 'max-w-xs'
                }`}
                style={{ backgroundColor: customize.bgColor }}
              >
                {/* Form Top Accent */}
                <div
                  className="h-2 w-full"
                  style={{ backgroundColor: customize.highlightColor }}
                />

                <div className="p-6 space-y-6">
                  {/* Form Header */}
                  <div className="text-center">
                    <h2
                      className="text-xl font-bold"
                      style={{ color: customize.textColor }}
                    >
                      {formTitle}
                    </h2>
                    {formHeaderDesc && (
                      <p
                        className="text-xs mt-1 opacity-70"
                        style={{ color: customize.textColor }}
                      >
                        {formHeaderDesc}
                      </p>
                    )}
                  </div>

                  {/* Sections */}
                  {sections.map((section) => (
                    <div key={section.id} className="space-y-4">
                      {section.title && (
                        <div className="border-b pb-1.5" style={{ borderColor: `${customize.textColor}20` }}>
                          <h4
                            className="text-sm font-bold"
                            style={{ color: customize.textColor }}
                          >
                            {section.title}
                          </h4>
                          {section.description && (
                            <p
                              className="text-[11px] opacity-70 mt-0.5"
                              style={{ color: customize.textColor }}
                            >
                              {section.description}
                            </p>
                          )}
                        </div>
                      )}

                      <div className="space-y-3">
                        {section.fields.map((field) => {
                          const isLeadCapturePhone = field.isLeadCapture || field.type === 'phone';
                          return (
                            <div key={field.id} className="space-y-1">
                              <label
                                className="text-xs font-semibold block"
                                style={{ color: customize.textColor }}
                              >
                                {field.label} {field.required && <span className="text-red-500">*</span>}
                              </label>

                              {isLeadCapturePhone ? (
                                <div className="flex items-center gap-2">
                                  <div className="px-2.5 py-1.5 bg-slate-100 rounded-lg text-xs font-semibold text-slate-700 border border-slate-300/80">
                                    {COUNTRY_CODES.find((c) => c.code === field.countryCode)?.flag || '🇮🇳'}{' '}
                                    {field.countryCode || '+91'}
                                  </div>
                                  <input
                                    type="text"
                                    placeholder={field.placeholder || 'Enter your phone number'}
                                    className="flex-1 px-3 py-1.5 rounded-lg text-xs border border-slate-300/80 bg-white/90 text-slate-800 outline-none"
                                  />
                                </div>
                              ) : field.type === 'longText' ? (
                                <textarea
                                  rows={2}
                                  placeholder={field.placeholder}
                                  className="w-full px-3 py-1.5 rounded-lg text-xs border border-slate-300/80 bg-white/90 text-slate-800 outline-none resize-none"
                                />
                              ) : field.type === 'dropdown' ? (
                                <div className="flex items-center justify-between px-3 py-1.5 rounded-lg text-xs border border-slate-300/80 bg-white/90 text-slate-500">
                                  <span>{field.placeholder || 'Select an option'}</span>
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </div>
                              ) : field.type === 'radio' ? (
                                <div className="space-y-1">
                                  {(field.options || ['Yes', 'No']).map((opt, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs" style={{ color: customize.textColor }}>
                                      <input type="radio" name={field.id} defaultChecked={i === 0} />
                                      <span>{opt}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : field.type === 'checkbox' ? (
                                <div className="space-y-1">
                                  {(field.options || ['Option A', 'Option B']).map((opt, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs" style={{ color: customize.textColor }}>
                                      <input type="checkbox" defaultChecked={i === 0} />
                                      <span>{opt}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : field.type === 'consent' ? (
                                <div className="flex items-center gap-2 text-xs" style={{ color: customize.textColor }}>
                                  <input type="checkbox" defaultChecked />
                                  <span>{field.placeholder || 'I agree to terms'}</span>
                                </div>
                              ) : (
                                <input
                                  type="text"
                                  placeholder={field.placeholder}
                                  className="w-full px-3 py-1.5 rounded-lg text-xs border border-slate-300/80 bg-white/90 text-slate-800 outline-none"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* Submit Button Preview */}
                  <div className="pt-2">
                    <button
                      type="button"
                      style={{
                        backgroundColor: customize.matchButton
                          ? customize.highlightColor
                          : '#2563EB',
                        color: '#FFFFFF',
                      }}
                      className="w-full py-2.5 rounded-xl font-semibold text-xs shadow-sm hover:opacity-95 transition-opacity"
                    >
                      {customize.buttonText || 'Submit Inquiry'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
