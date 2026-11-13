import { PropertyDoc, PropertyFilter } from '../types/property';

export function formatPHP(amount: number, isRental = false): string {
  if (isRental) {
    return `₱${amount.toLocaleString('en-US')} /mo`;
  }
  return `₱${amount.toLocaleString('en-US')}`;
}

export function filterProperties(
  properties: PropertyDoc[],
  filter: Partial<PropertyFilter>
): PropertyDoc[] {
  return properties.filter((property) => {
    // Only approved properties can be displayed publicly
    if (property.status !== 'approved') {
      return false;
    }

    // Featured filter
    if (filter.featuredOnly && !property.featured) {
      return false;
    }

    // Type filter
    if (filter.type && filter.type !== 'All Types' && property.propertyType !== filter.type) {
      return false;
    }

    // Location filter
    if (filter.location && filter.location !== 'All Areas' && property.location !== filter.location) {
      return false;
    }

    // Building filter
    if (filter.buildingId && filter.buildingId !== 'all' && property.buildingId !== filter.buildingId) {
      return false;
    }

    // Listing type (sale or rent)
    if (filter.listingType && filter.listingType !== 'all' && property.listingType !== filter.listingType) {
      return false;
    }

    // Min price
    if (typeof filter.minPrice === 'number' && filter.minPrice > 0) {
      if (property.price < filter.minPrice) return false;
    }

    // Max price
    if (typeof filter.maxPrice === 'number' && filter.maxPrice > 0) {
      if (property.price > filter.maxPrice) return false;
    }

    // Bedrooms
    if (filter.bedrooms && filter.bedrooms !== 'all') {
      if (filter.bedrooms >= 4) {
        if (property.bedrooms < 4) return false;
      } else {
        if (property.bedrooms !== filter.bedrooms) return false;
      }
    }

    // Search query match
    if (filter.searchQuery && filter.searchQuery.trim().length > 0) {
      const q = filter.searchQuery.toLowerCase().trim();
      const inTitle = property.propertyTitle.toLowerCase().includes(q);
      const inBuilding = property.buildingName.toLowerCase().includes(q);
      const inLocation = property.location.toLowerCase().includes(q);
      const inDesc = property.description.toLowerCase().includes(q);
      if (!inTitle && !inBuilding && !inLocation && !inDesc) {
        return false;
      }
    }

    return true;
  });
}

export function validateInquiryForm(formData: {
  fullName: string;
  email: string;
  phone: string;
  message?: string;
}): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!formData.fullName || formData.fullName.trim().length < 2) {
    errors.fullName = 'Full name must be at least 2 characters';
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!formData.email || !emailRegex.test(formData.email.trim())) {
    errors.email = 'Please provide a valid email address';
  }

  const phoneRegex = /^[0-9+()\- ]{7,20}$/;
  if (!formData.phone || !phoneRegex.test(formData.phone.trim())) {
    errors.phone = 'Please provide a valid contact number';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function canAgentEditProperty(agentId: string, property: PropertyDoc): boolean {
  if (property.agentId !== agentId) return false;
  // Agents can edit draft, rejected, or submit revisions on approved properties
  return ['draft', 'rejected', 'approved'].includes(property.status);
}

export function applyApprovalDecision(
  property: PropertyDoc,
  approverId: string,
  approved: boolean,
  rejectionReason?: string
): PropertyDoc {
  const now = new Date().toISOString();

  if (approved) {
    // If approving revision edits
    if (property.hasPendingReview && property.pendingChanges) {
      return {
        ...property,
        ...property.pendingChanges,
        status: 'approved',
        approvedAt: now,
        approvedBy: approverId,
        rejectionReason: null,
        hasPendingReview: false,
        pendingChanges: null,
        updatedAt: now,
      };
    }

    return {
      ...property,
      status: 'approved',
      approvedAt: now,
      approvedBy: approverId,
      rejectionReason: null,
      hasPendingReview: false,
      updatedAt: now,
    };
  }

  // If rejected
  if (property.status === 'approved' && property.hasPendingReview) {
    return {
      ...property,
      hasPendingReview: false,
      rejectionReason: `Revision rejected: ${rejectionReason || 'Requires modifications.'}`,
      updatedAt: now,
    };
  }

  return {
    ...property,
    status: 'rejected',
    rejectionReason: rejectionReason || 'Listing did not meet publication standards.',
    updatedAt: now,
    approvedBy: approverId,
  };
}

export function calculateAgentMetrics(properties: PropertyDoc[]) {
  let approvedCount = 0;
  let pendingCount = 0;
  let draftCount = 0;
  let rejectedCount = 0;

  for (const p of properties) {
    if (p.status === 'approved') approvedCount++;
    else if (p.status === 'pending') pendingCount++;
    else if (p.status === 'draft') draftCount++;
    else if (p.status === 'rejected') rejectedCount++;
  }

  return {
    total: properties.length,
    approvedCount,
    pendingCount,
    draftCount,
    rejectedCount,
  };
}

export function canManagePropertyPhotos(
  userId: string | undefined,
  isSuperAdmin: boolean,
  property: PropertyDoc
): boolean {
  if (isSuperAdmin) return true;
  return Boolean(userId && property.agentId && userId === property.agentId);
}

export const DEFAULT_INQUIRY_EMAIL_SUBJECT =
  'New Property Inquiry: {{property}} — {{clientName}}';

export const DEFAULT_INQUIRY_EMAIL_BODY = `Hello Cebu Prime Properties Team,

A new client inquiry has been submitted through the website.

Client Name: {{clientName}}
Email Address: {{clientEmail}}
Phone Number: {{clientPhone}}
Property of Interest: {{property}}
Submitted At: {{date}}

Message / Request:
{{message}}

Please follow up promptly to schedule a consultation or private viewing.`;

export function formatInquiryNotificationEmail(
  template: { subject?: string; body?: string },
  inquiry: {
    fullName: string;
    email: string;
    phone: string;
    propertyInterest?: string;
    message?: string;
    createdAt?: string;
  }
): { subject: string; body: string } {
  const safeProperty = inquiry.propertyInterest?.trim() || 'General Property Inquiry';
  const safeMessage = inquiry.message?.trim() || 'Requesting brochure, pricing, and private viewing schedule.';
  const formattedDate = inquiry.createdAt
    ? new Date(inquiry.createdAt).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : new Date().toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });

  const applyTokens = (input: string) =>
    input
      .replace(/\{\{clientName\}\}/g, inquiry.fullName.trim())
      .replace(/\{\{clientEmail\}\}/g, inquiry.email.trim())
      .replace(/\{\{clientPhone\}\}/g, inquiry.phone.trim())
      .replace(/\{\{property\}\}/g, safeProperty)
      .replace(/\{\{message\}\}/g, safeMessage)
      .replace(/\{\{date\}\}/g, formattedDate);

  const subjectTpl = template.subject?.trim() || DEFAULT_INQUIRY_EMAIL_SUBJECT;
  const bodyTpl = template.body?.trim() || DEFAULT_INQUIRY_EMAIL_BODY;

  return {
    subject: applyTokens(subjectTpl),
    body: applyTokens(bodyTpl),
  };
}

export function isDuplicateBuildingName(
  buildings: Array<{ buildingId: string; buildingName: string }>,
  name: string,
  excludeBuildingId?: string
): boolean {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return false;
  return buildings.some(
    (b) => b.buildingId !== excludeBuildingId && b.buildingName.trim().toLowerCase() === normalized
  );
}

export function paginateItems<T>(
  items: T[],
  page: number,
  pageSize: number
): {
  items: T[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
} {
  const safeSize = Math.max(1, pageSize);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safeSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * safeSize;
  return {
    items: items.slice(start, start + safeSize),
    currentPage,
    totalPages,
    totalItems,
  };
}


