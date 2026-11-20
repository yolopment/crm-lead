import { Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { LeadDistributionService } from '../services/leadDistribution.service.js';

export class FormController {
  static async listForms(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      let forms = await prisma.form.findMany({
        where: { orgId },
        orderBy: { createdAt: 'desc' },
      });

      // Seed default forms matching Screenshot 1 if needed
      if (forms.length === 0) {
        const sample1 = await prisma.form.create({
          data: {
            orgId,
            name: 'Sample — Website enquiries',
            description: 'Direct inquiries from main landing page',
            slug: 'website-enquiries',
            formCode: 'F-1',
            status: 'ACTIVE',
            fieldsJson: JSON.stringify([
              { id: 'f1', type: 'fullName', label: 'Full Name', placeholder: 'Enter your full name', required: true },
              { id: 'f2', type: 'email', label: 'Email Address', placeholder: 'Enter your email address', required: false },
              { id: 'f3', type: 'phone', label: 'Phone Number', placeholder: 'Enter your phone number', required: true },
              { id: 'f4', type: 'shortText', label: 'Company', placeholder: 'Enter company name', required: false },
              { id: 'f5', type: 'longText', label: 'Requirements', placeholder: 'How can we help?', required: false },
            ]),
            sectionsCount: 1,
            submissionsCount: 8,
            createdByName: req.user?.name || 'Aftab Sk',
            settingsJson: JSON.stringify({
              successMessage: 'Thank you for your submission!',
              redirectUrl: '',
              requireEmailVerification: false,
              isActive: true,
            }),
            customizeJson: JSON.stringify({
              themePreset: 'Ocean Breeze',
              bgColor: '#FFFFFF',
              textColor: '#333333',
              highlightColor: '#007BFF',
              matchButton: true,
            }),
          },
        });

        const sample2 = await prisma.form.create({
          data: {
            orgId,
            name: 'Unnamed Form',
            description: 'TESTING FORM',
            slug: 'unnamed-form',
            formCode: 'F-2',
            status: 'ACTIVE',
            fieldsJson: JSON.stringify([
              { id: 'f1', type: 'fullName', label: 'Full Name', placeholder: 'Enter your full name', required: false },
              { id: 'f2', type: 'email', label: 'Email Address', placeholder: 'Enter your email address', required: false },
              { id: 'f3', type: 'phone', label: 'Phone Number', placeholder: 'Enter your phone number', required: true },
            ]),
            sectionsCount: 1,
            submissionsCount: 0,
            createdByName: req.user?.name || 'Aftab Sk',
            settingsJson: JSON.stringify({
              successMessage: 'Thank you for your submission!',
              redirectUrl: 'https://yourwebsite.com/thank-you',
              requireEmailVerification: false,
              isActive: true,
            }),
            customizeJson: JSON.stringify({
              themePreset: 'Ocean Breeze',
              bgColor: '#FFFFFF',
              textColor: '#333333',
              highlightColor: '#007BFF',
              matchButton: true,
            }),
          },
        });

        forms = [sample2, sample1];
      }

      res.status(200).json({ forms });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to list forms.' });
    }
  }

  static async getForm(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const { formId } = req.params;

      const form = await prisma.form.findFirst({
        where: { id: formId, orgId },
      });

      if (!form) {
        res.status(404).json({ error: 'Form not found.' });
        return;
      }

      res.status(200).json({ form });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch form.' });
    }
  }

  static async createForm(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const {
        name,
        description,
        fieldsJson = '[]',
        sectionsCount = 1,
        settingsJson = '{}',
        customizeJson = '{}',
      } = req.body;

      if (!name) {
        res.status(400).json({ error: 'Form name is required.' });
        return;
      }

      const count = await prisma.form.count({ where: { orgId } });
      const formCode = `F-${count + 1}`;
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString().slice(-4);

      const form = await prisma.form.create({
        data: {
          orgId,
          name,
          description: description || null,
          slug,
          formCode,
          status: 'ACTIVE',
          fieldsJson: typeof fieldsJson === 'string' ? fieldsJson : JSON.stringify(fieldsJson),
          sectionsCount: Number(sectionsCount) || 1,
          settingsJson: typeof settingsJson === 'string' ? settingsJson : JSON.stringify(settingsJson),
          customizeJson: typeof customizeJson === 'string' ? customizeJson : JSON.stringify(customizeJson),
          createdByName: req.user?.name || 'Aftab Sk',
        },
      });

      res.status(201).json(form);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to create form.' });
    }
  }

  static async updateForm(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const { formId } = req.params;
      const {
        name,
        description,
        status,
        fieldsJson,
        sectionsCount,
        settingsJson,
        customizeJson,
      } = req.body;

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (status !== undefined) updateData.status = status;
      if (fieldsJson !== undefined) {
        updateData.fieldsJson = typeof fieldsJson === 'string' ? fieldsJson : JSON.stringify(fieldsJson);
      }
      if (sectionsCount !== undefined) updateData.sectionsCount = Number(sectionsCount);
      if (settingsJson !== undefined) {
        updateData.settingsJson = typeof settingsJson === 'string' ? settingsJson : JSON.stringify(settingsJson);
      }
      if (customizeJson !== undefined) {
        updateData.customizeJson = typeof customizeJson === 'string' ? customizeJson : JSON.stringify(customizeJson);
      }

      const updated = await prisma.form.update({
        where: { id: formId },
        data: updateData,
      });

      res.status(200).json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update form.' });
    }
  }

  static async deleteForm(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const { formId } = req.params;

      await prisma.form.deleteMany({
        where: { id: formId, orgId },
      });

      res.status(200).json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to delete form.' });
    }
  }

  static async getSubmissions(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const { formId } = req.params;

      const form = await prisma.form.findFirst({
        where: { id: formId, orgId },
      });

      if (!form) {
        res.status(404).json({ error: 'Form not found.' });
        return;
      }

      const submissions = await prisma.lead.findMany({
        where: {
          orgId,
          campaignName: form.name,
        },
        include: {
          assignedTo: {
            select: { id: true, name: true, email: true, phone: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.status(200).json({ submissions, count: submissions.length, formName: form.name });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch form submissions.' });
    }
  }

  static async duplicateForm(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const { formId } = req.params;

      const source = await prisma.form.findFirst({
        where: { id: formId, orgId },
      });

      if (!source) {
        res.status(404).json({ error: 'Form not found.' });
        return;
      }

      const count = await prisma.form.count({ where: { orgId } });
      const newFormCode = `F-${count + 1}`;
      const newSlug = `${source.slug}-copy-${Date.now().toString().slice(-4)}`;

      const duplicated = await prisma.form.create({
        data: {
          orgId,
          name: `${source.name} (Copy)`,
          description: source.description,
          slug: newSlug,
          formCode: newFormCode,
          status: source.status,
          fieldsJson: source.fieldsJson,
          sectionsCount: source.sectionsCount,
          submissionsCount: 0,
          settingsJson: source.settingsJson,
          customizeJson: source.customizeJson,
          createdByName: req.user?.name || source.createdByName || 'Aftab Sk',
        },
      });

      res.status(201).json(duplicated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to duplicate form.' });
    }
  }

  static async toggleStatus(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const { formId } = req.params;

      const form = await prisma.form.findFirst({
        where: { id: formId, orgId },
      });

      if (!form) {
        res.status(404).json({ error: 'Form not found.' });
        return;
      }

      const newStatus = form.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

      const updated = await prisma.form.update({
        where: { id: formId },
        data: { status: newStatus },
      });

      res.status(200).json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to toggle status.' });
    }
  }

  // Public fetch endpoint for embedded form pages
  static async getPublicForm(req: Request, res: Response): Promise<void> {
    try {
      const { slug } = req.params;
      const form = await prisma.form.findFirst({
        where: {
          OR: [{ slug }, { id: slug }],
          status: 'ACTIVE',
        },
      });

      if (!form) {
        res.status(404).json({ error: 'Form not found or inactive.' });
        return;
      }

      res.status(200).json({ form });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load form.' });
    }
  }

  // Public webhook / API endpoint for embedded form submissions
  static async submitForm(req: Request, res: Response): Promise<void> {
    try {
      const { slug } = req.params;
      const { fullName, phone, email, company, ...otherData } = req.body;

      const form = await prisma.form.findFirst({
        where: { slug, status: 'ACTIVE' },
      });

      if (!form) {
        res.status(404).json({ error: 'Form not found or inactive.' });
        return;
      }

      if (!phone) {
        res.status(400).json({ error: 'Phone number is required.' });
        return;
      }

      const cleanPhone = String(phone).replace(/[\s\-\(\)]/g, '');

      let settings: any = {};
      try {
        settings = JSON.parse(form.settingsJson || '{}');
      } catch (e) {}

      let assignedToId = settings.assignedAgentId || null;
      if (!assignedToId) {
        assignedToId = await LeadDistributionService.assignNextAvailableAgent(form.orgId);
      }

      const lead = await prisma.lead.create({
        data: {
          orgId: form.orgId,
          phone: cleanPhone,
          fullName: fullName?.trim() || null,
          email: email?.trim() || null,
          company: company?.trim() || null,
          source: 'website',
          campaignName: form.name,
          tags: 'web_form',
          stageName: 'Fresh',
          customFields: Object.keys(otherData).length > 0 ? JSON.stringify(otherData) : null,
          assignedToId,
        },
      });

      // Increment form submission count
      await prisma.form.update({
        where: { id: form.id },
        data: { submissionsCount: { increment: 1 } },
      });

      res.status(201).json({
        success: true,
        message: settings.successMessage || 'Thank you! Your inquiry has been received.',
        redirectUrl: settings.redirectUrl || null,
        leadId: lead.id,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Form submission failed.' });
    }
  }
}
