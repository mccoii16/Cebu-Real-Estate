import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { FloatingSearchBar } from './components/FloatingSearchBar';
import { FeaturedProperties } from './components/FeaturedProperties';
import { ExploreLocations } from './components/ExploreLocations';
import { AboutSection } from './components/AboutSection';
import { ContactSection } from './components/ContactSection';
import { Footer } from './components/Footer';
import { PropertyModal } from './components/PropertyModal';
import { InquiryModal } from './components/InquiryModal';
import { SearchModal } from './components/SearchModal';
import { FavoritesDrawer } from './components/FavoritesDrawer';
import { AllPropertiesView } from './components/AllPropertiesView';
import { AuthModal } from './components/auth/AuthModal';
import { SuperAdminDashboard } from './components/dashboard/SuperAdminDashboard';
import { AgentDashboard } from './components/dashboard/AgentDashboard';
import { NavTabId } from './components/LiquidNotchNav';
import { PropertyDoc, BuildingDoc, PropertyFilter } from './types/property';
import {
  getApprovedProperties,
  getAllPropertiesForStaff,
  getAllBuildings,
  seedInitialFirestoreData,
  applyPropertyFilters,
} from './services/propertyService';
import { testFirestoreConnection } from './services/firebase';
import { AuthProvider, useAuth } from './context/AuthContext';

const DEFAULT_FILTER: PropertyFilter = {
  type: 'All Types',
  location: 'All Areas',
  buildingId: 'all',
  listingType: 'all',
  minPrice: 0,
  maxPrice: 0,
  bedrooms: 'all',
  searchQuery: '',
};

function MainApp() {
  const { user, profile, isSuperAdmin, isAgent, loading: authLoading } = useAuth();

  const [currentView, setCurrentView] = useState<'public' | 'superadmin' | 'agent'>('public');
  const [activeTab, setActiveTab] = useState<NavTabId>('home');
  const [properties, setProperties] = useState<PropertyDoc[]>([]);
  const [buildings, setBuildings] = useState<BuildingDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<PropertyFilter>(DEFAULT_FILTER);
  const [allPropertiesViewOpen, setAllPropertiesViewOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<PropertyDoc | null>(null);
  const [inquiryModalOpen, setInquiryModalOpen] = useState(false);
  const [inquiryPropertyTitle, setInquiryPropertyTitle] = useState('The Alcoves');
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [favoritesDrawerOpen, setFavoritesDrawerOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Favorites state with localStorage
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('cebu_prime_favorites');
      return saved ? JSON.parse(saved) : ['prop-alcoves-18b'];
    } catch {
      return ['prop-alcoves-18b'];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('cebu_prime_favorites', JSON.stringify(favorites));
    } catch (e) {
      console.warn('Failed to save favorites to localStorage', e);
    }
  }, [favorites]);

  // Load Firestore data on mount or when user role changes
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      await testFirestoreConnection();
      await seedInitialFirestoreData();

      const [fetchedProperties, fetchedBuildings] = await Promise.all([
        isSuperAdmin
          ? getAllPropertiesForStaff('superadmin', user?.uid)
          : isAgent
          ? getAllPropertiesForStaff('agent', user?.uid)
          : getApprovedProperties(),
        getAllBuildings(),
      ]);

      setProperties(fetchedProperties);
      setBuildings(fetchedBuildings);
    } catch (err) {
      console.error('Error fetching Firestore properties:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isSuperAdmin, isAgent, user?.uid]);

  useEffect(() => {
    if (!authLoading) {
      loadData();
    }
  }, [loadData, authLoading]);

  const toggleFavorite = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleTabChange = (tab: NavTabId) => {
    setActiveTab(tab);
    if (tab === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (tab === 'properties') {
      setAllPropertiesViewOpen(true);
    } else {
      const el = document.getElementById(tab);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const handleSearchExecute = () => {
    const el = document.getElementById('properties');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleLocationSelect = (locName: string) => {
    setFilter((prev) => ({ ...prev, location: locName }));
    const el = document.getElementById('properties');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleOpenInquireWithProperty = (title: string) => {
    setInquiryPropertyTitle(title);
    setInquiryModalOpen(true);
  };

  const handlePropertyUpdated = (updated: PropertyDoc) => {
    setProperties((prev) => {
      const exists = prev.some((p) => p.propertyId === updated.propertyId);
      if (exists) {
        return prev.map((p) => (p.propertyId === updated.propertyId ? updated : p));
      }
      return [updated, ...prev];
    });
    setSelectedProperty(updated);
  };

  const handlePropertyDeleted = (propertyId: string) => {
    setProperties((prev) => prev.filter((p) => p.propertyId !== propertyId));
    if (selectedProperty?.propertyId === propertyId) {
      setSelectedProperty(null);
    }
  };

  const handleBuildingAdded = (newBld: BuildingDoc) => {
    setBuildings((prev) => [...prev, newBld]);
  };

  const handleBuildingDeleted = (buildingId: string) => {
    setBuildings((prev) => prev.filter((b) => b.buildingId !== buildingId));
  };

  // Portal button handler in Header
  const handlePortalClick = () => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    if (isSuperAdmin) {
      setCurrentView('superadmin');
    } else if (isAgent) {
      setCurrentView('agent');
    } else {
      setAuthModalOpen(true);
    }
  };

  // If in Super Admin view
  if (currentView === 'superadmin' && isSuperAdmin) {
    return (
      <>
        <SuperAdminDashboard
          properties={properties}
          buildings={buildings}
          onPropertyUpdated={handlePropertyUpdated}
          onPropertyDeleted={handlePropertyDeleted}
          onBuildingAdded={handleBuildingAdded}
          onBuildingDeleted={handleBuildingDeleted}
          onViewPublicSite={() => setCurrentView('public')}
          onSelectPropertyPreview={setSelectedProperty}
        />

        {/* Quick View / Property Detail Modal */}
        <PropertyModal
          property={selectedProperty}
          onClose={() => setSelectedProperty(null)}
          isFavorite={selectedProperty ? favorites.includes(selectedProperty.propertyId) : false}
          onToggleFavorite={toggleFavorite}
          onInquireAboutProperty={handleOpenInquireWithProperty}
          onPropertyUpdated={handlePropertyUpdated}
        />
      </>
    );
  }

  // If in Agent view
  if (currentView === 'agent' && isAgent) {
    return (
      <>
        <AgentDashboard
          properties={properties}
          buildings={buildings}
          onPropertyUpdated={handlePropertyUpdated}
          onPropertyDeleted={handlePropertyDeleted}
          onViewPublicSite={() => setCurrentView('public')}
          onSelectPropertyPreview={setSelectedProperty}
        />

        {/* Quick View / Property Detail Modal */}
        <PropertyModal
          property={selectedProperty}
          onClose={() => setSelectedProperty(null)}
          isFavorite={selectedProperty ? favorites.includes(selectedProperty.propertyId) : false}
          onToggleFavorite={toggleFavorite}
          onInquireAboutProperty={handleOpenInquireWithProperty}
          onPropertyUpdated={handlePropertyUpdated}
        />
      </>
    );
  }

  // Public View: Only approved properties
  const approvedListings = properties.filter((p) => p.status === 'approved');
  const filteredApproved = applyPropertyFilters(approvedListings, filter);
  const featuredProperties = filteredApproved.filter((p) => p.featured).slice(0, 4);
  const homepageProperties =
    featuredProperties.length > 0 ? featuredProperties : filteredApproved.slice(0, 4);

  return (
    <div className="min-h-screen bg-[#F8F7F3] flex flex-col selection:bg-[#C6A878]/30 selection:text-[#17243B]">
      {/* Dark Hero Header Wrapper */}
      <div className="relative bg-[#17243B]">
        <Header
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onOpenSearch={() => setSearchModalOpen(true)}
          onOpenInquire={() => handleOpenInquireWithProperty('The Alcoves')}
          favoriteCount={favorites.length}
          onOpenFavorites={() => setFavoritesDrawerOpen(true)}
          onOpenPortal={handlePortalClick}
          userRole={isSuperAdmin ? 'superadmin' : isAgent ? 'agent' : null}
          userDisplayName={profile?.displayName || user?.displayName}
        />

        <Hero
          onExploreClick={() => {
            const el = document.getElementById('properties');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
        />
      </div>

      {/* Floating Pill Search Bar Overlapping Hero/Content Boundary */}
      <FloatingSearchBar
        filter={filter}
        onFilterChange={setFilter}
        onSearchExecute={handleSearchExecute}
      />

      {/* Main Content Sections */}
      <main className="flex-1">
        {/* Featured Properties Section (Powered dynamically by Firestore) */}
        <FeaturedProperties
          properties={homepageProperties}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          onSelectProperty={setSelectedProperty}
          onViewAllClick={() => setAllPropertiesViewOpen(true)}
          isLoading={isLoading}
        />

        {/* Explore Top Locations Section */}
        <ExploreLocations
          onSelectLocation={handleLocationSelect}
          onBrowseAllLocations={() => {
            setFilter(DEFAULT_FILTER);
            setAllPropertiesViewOpen(true);
          }}
        />

        {/* About Us & Proven Track Record */}
        <AboutSection />

        {/* Private Client Inquiries & Contact Form */}
        <ContactSection initialPropertyInterest={inquiryPropertyTitle} />
      </main>

      {/* Footer */}
      <Footer onNavClick={handleTabChange} />

      {/* All Properties Gallery & Filter View */}
      <AllPropertiesView
        isOpen={allPropertiesViewOpen}
        onClose={() => setAllPropertiesViewOpen(false)}
        properties={filteredApproved}
        buildings={buildings}
        filter={filter}
        onFilterChange={setFilter}
        onResetFilter={() => setFilter(DEFAULT_FILTER)}
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
        onSelectProperty={setSelectedProperty}
      />

      {/* Quick View / Property Detail Page Modal */}
      <PropertyModal
        property={selectedProperty}
        onClose={() => setSelectedProperty(null)}
        isFavorite={selectedProperty ? favorites.includes(selectedProperty.propertyId) : false}
        onToggleFavorite={toggleFavorite}
        onInquireAboutProperty={handleOpenInquireWithProperty}
        onPropertyUpdated={handlePropertyUpdated}
      />

      {/* Inquiry Dialog Modal */}
      <InquiryModal
        isOpen={inquiryModalOpen}
        onClose={() => setInquiryModalOpen(false)}
        defaultProperty={inquiryPropertyTitle}
      />

      {/* Search Overlay Modal */}
      <SearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        properties={approvedListings}
        onSelectProperty={setSelectedProperty}
      />

      {/* Saved Properties Drawer */}
      <FavoritesDrawer
        isOpen={favoritesDrawerOpen}
        onClose={() => setFavoritesDrawerOpen(false)}
        favorites={favorites}
        properties={approvedListings}
        onRemoveFavorite={toggleFavorite}
        onSelectProperty={setSelectedProperty}
        onInquireNow={() => handleOpenInquireWithProperty('Saved Portfolio')}
      />

      {/* Staff & Agent Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={() => {
          if (isSuperAdmin) setCurrentView('superadmin');
          else if (isAgent) setCurrentView('agent');
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
