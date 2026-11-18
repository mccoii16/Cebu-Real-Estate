export type PropertyType = 'All Types' | 'Condo' | 'Penthouse' | 'House & Lot' | 'Commercial' | 'Townhouse';

export type ListingType = 'all' | 'sale' | 'rent';

export type PropertyLocation =
  | 'All Areas'
  | 'Cebu Business Park'
  | 'Cebu IT Park'
  | 'Mactan Newtown'
  | 'Banilad'
  | 'Lahug'
  | 'SRP'
  | 'Mandaue'
  | 'Lapu-Lapu City';

export type PropertyStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'archived';

export type ContentPublishStatus = 'published' | 'unpublished' | 'archived';

export type Property = PropertyDoc;

export type UserRole = 'superadmin' | 'editor' | 'agent' | 'user';

export type AuditAction =
  | 'create'
  | 'update'
  | 'publish'
  | 'unpublish'
  | 'archive'
  | 'restore'
  | 'upload_photo';

export type AuditContentType = 'property' | 'building' | 'neighborhood';

export interface AuditLogDoc {
  logId: string;
  editorId: string;
  editorEmail: string;
  editorName: string;
  editorRole: 'editor' | 'superadmin';
  contentType: AuditContentType;
  contentId: string;
  contentTitle: string;
  action: AuditAction;
  changedFields: string[];
  summary: string;
  timestamp: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: 'active' | 'disabled' | 'deleted';
  temporaryPassword?: string;
  totalProperties?: number;
  approvedCount?: number;
  pendingCount?: number;
  draftCount?: number;
  rejectedCount?: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  createdByEmail?: string;
  disabledAt?: string;
  disabledBy?: string;
  deletedAt?: string;
  deletedBy?: string;
  passwordResetRequestedAt?: string;
  passwordResetRequestedBy?: string;
  lastPasswordResetLink?: string;
}

export interface PropertyDoc {
  propertyId: string;
  slug?: string;
  buildingId: string;
  buildingName: string;
  propertyTitle: string;
  location: string;
  address: string;
  propertyType: string;
  listingType: 'sale' | 'rent';
  price: number;
  bedrooms: number;
  bathrooms: number;
  floorArea: number;
  lotArea?: number | null;
  parkingSpaces?: number | null;
  furnishingStatus?: string;
  floorLevel?: string;
  availabilityLabel?: string;
  latitude?: number | null;
  longitude?: number | null;
  mapUrl?: string;
  description: string;
  features?: string[];
  amenities: string[];
  images: string[];
  seoTitle?: string;
  seoDescription?: string;
  featured: boolean;
  status: PropertyStatus;
  previousStatus?: Exclude<PropertyStatus, 'archived'> | null;
  archivedAt?: string | null;
  agentId: string;
  agentName: string;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  hasPendingReview?: boolean;
  pendingChanges?: Partial<PropertyDoc> | null;
  lastModifiedByUid?: string;
  lastModifiedByEmail?: string;
}

export interface BuildingDoc {
  buildingId: string;
  slug?: string;
  buildingName: string;
  location: string;
  address: string;
  description: string;
  developer?: string;
  buildingType?: string;
  yearCompleted?: number | null;
  totalFloors?: number | null;
  buildingImages: string[];
  amenities: string[];
  facilities?: string[];
  nearbyLandmarks?: string[];
  latitude?: number | null;
  longitude?: number | null;
  mapUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
  status?: ContentPublishStatus;
  previousStatus?: 'published' | 'unpublished' | null;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  lastModifiedByUid?: string;
  lastModifiedByEmail?: string;
}

export interface PropertyFilter {
  type: PropertyType;
  location: string;
  buildingId: string;
  listingType: ListingType;
  minPrice: number;
  maxPrice: number;
  bedrooms: number | 'all';
  searchQuery?: string;
  featuredOnly?: boolean;
}

export interface LocationHighlight {
  id: string;
  slug?: string;
  name: string;
  tagline: string;
  propertyCount: number;
  image: string;
  galleryImages?: string[];
  description: string;
  cityOrMunicipality?: string;
  highlights?: string[];
  nearbyLandmarks?: string[];
  lifestyleInfo?: string;
  transportationInfo?: string;
  latitude?: number | null;
  longitude?: number | null;
  mapUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
  status?: ContentPublishStatus;
  previousStatus?: 'published' | 'unpublished' | null;
  archivedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  lastModifiedByUid?: string;
  lastModifiedByEmail?: string;
}

export interface InquiryFormData {
  fullName: string;
  email: string;
  phone: string;
  propertyInterest: string;
  preferredContact: 'email' | 'phone' | 'whatsapp';
  message: string;
}

export interface InquiryDoc extends InquiryFormData {
  inquiryId: string;
  status: 'new' | 'contacted' | 'closed' | 'archived';
  createdAt: string;
  recipientEmail?: string;
  notificationSubject?: string;
  notificationMessage?: string;
}

export interface HeroSlideConfig {
  id: number;
  label: string;
  location: string;
  image: string;
  headlineLine1: string;
  headlineLine2: string;
  subheading: string;
}

export interface WebsiteSettings {
  siteName: string;
  logoSubtitle: string;
  heroHeadline: string;
  heroSubheading: string;
  heroBadge: string;
  contactEmail: string;
  contactPhone: string;
  officeAddress: string;
  facebookUrl?: string;
  instagramUrl?: string;
  linkedinUrl?: string;
  heroImages?: string[];
  heroSlides?: HeroSlideConfig[];
  aboutImage?: string;
  inquiryNotificationEmail?: string;
  inquiryNotificationSubject?: string;
  inquiryEmailTemplate?: string;
  inquiryAutoReplyMessage?: string;
  updatedAt?: string;
  updatedBy?: string;
}

