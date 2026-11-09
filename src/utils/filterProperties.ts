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
