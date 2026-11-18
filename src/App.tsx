import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
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
import { EditorDashboard } from './components/dashboard/EditorDashboard';
import { AgentDashboard } from './components/dashboard/AgentDashboard';
import { PropertyDetailPage } from './components/pages/PropertyDetailPage';
import { BuildingDetailPage } from './components/pages/BuildingDetailPage';
import { NeighborhoodDetailPage } from './components/pages/NeighborhoodDetailPage';
import { NotFoundPage } from './components/pages/NotFoundPage';
import { NavTabId } from './components/LiquidNotchNav';
import { PropertyDoc, BuildingDoc, PropertyFilter, LocationHighlight, WebsiteSettings } from './types/property';
import {
  getApprovedProperties,
  getAllPropertiesForStaff,
  getAllBuildings,
  getPropertyBySlug,
  getBuildingBySlug,
  seedInitialFirestoreData,
  applyPropertyFilters,
} from './services/propertyService';
import { getAllLocations, getNeighborhoodBySlug } from './services/locationService';
import { getWebsiteSettings, getCachedWebsiteSettings } from './services/settingsService';
import { testFirestoreConnection } from './services/firebase';
import { AuthProvider, useAuth } from './context/AuthContext';
import {
  buildNeighborhoodPath,
  buildPropertyPath,
  findApprovedPropertyBySlug,
  findBuildingBySlug,
  findNeighborhoodBySlug,
  parseRoute,
} from './utils/slugs';
import { applySeoMetadata, getOrigin } from './utils/seo';
import {
  collectAllReferencedImageUrls,
  isBuildingPubliclyVisible,
  isNeighborhoodPubliclyVisible,
} from './utils/contentManagement';

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
  const { user, profile, isSuperAdmin, isEditor, isAgent, loading: authLoading } = useAuth();

  const [currentView, setCurrentView] = useState<'public' | 'superadmin' | 'editor' | 'agent'>('public');
  const [currentPath, setCurrentPath] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname || '/' : '/'
  );
  const [activeTab, setActiveTab] = useState<NavTabId>('home');
  const [pendingScrollSection, setPendingScrollSection] = useState<NavTabId | null>(null);

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

  const [locations, setLocations] = useState<LocationHighlight[]>([]);
  const [siteSettings, setSiteSettings] = useState<WebsiteSettings>(getCachedWebsiteSettings);

  const [resolvedPropertyFallback, setResolvedPropertyFallback] = useState<PropertyDoc | null>(null);
  const [resolvedBuildingFallback, setResolvedBuildingFallback] = useState<BuildingDoc | null>(null);
  const [resolvedNeighborhoodFallback, setResolvedNeighborhoodFallback] = useState<LocationHighlight | null>(null);
  const [isResolvingRoute, setIsResolvingRoute] = useState(false);
  const [attemptedLookupPath, setAttemptedLookupPath] = useState<string | null>(null);

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

  // Listen to browser back / forward navigation
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
      setAllPropertiesViewOpen(false);
      setSearchModalOpen(false);
      setFavoritesDrawerOpen(false);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Load Firestore data on mount or when user role changes
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      await testFirestoreConnection();
      await seedInitialFirestoreData();

      const [fetchedProperties, fetchedBuildings, fetchedLocations, fetchedSettings] = await Promise.all([
        isSuperAdmin
          ? getAllPropertiesForStaff('superadmin', user?.uid)
          : isEditor
          ? getAllPropertiesForStaff('editor', user?.uid)
          : isAgent
          ? getAllPropertiesForStaff('agent', user?.uid)
          : getApprovedProperties(),
        getAllBuildings(),
        getAllLocations(),
        getWebsiteSettings(),
      ]);

      setProperties(fetchedProperties);
      setBuildings(fetchedBuildings);
      setLocations(fetchedLocations);
      setSiteSettings(fetchedSettings);
    } catch (err) {
      console.error('Error fetching Firestore properties:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isSuperAdmin, isEditor, isAgent, user?.uid]);

  useEffect(() => {
    if (!authLoading) {
      loadData();
    }
  }, [loadData, authLoading]);

  const route = useMemo(() => parseRoute(currentPath), [currentPath]);
  const approvedListings = useMemo(
    () => properties.filter((p) => p.status === 'approved'),
    [properties]
  );
  const publicBuildings = useMemo(
    () => buildings.filter(isBuildingPubliclyVisible),
    [buildings]
  );
  const publicLocations = useMemo(
    () => locations.filter(isNeighborhoodPubliclyVisible),
    [locations]
  );
  const allReferencedImageUrls = useMemo(
    () =>
      collectAllReferencedImageUrls({
        properties,
        buildings,
        locations,
        siteSettings,
      }),
    [properties, buildings, locations, siteSettings]
  );

  const navigateTo = useCallback(
    (path: string, scrollSection?: NavTabId) => {
      const targetPath = path && path.startsWith('/') ? path : `/${path || ''}`;
      if (currentView !== 'public') {
        setCurrentView('public');
      }
      setAllPropertiesViewOpen(false);
      setSearchModalOpen(false);
      setFavoritesDrawerOpen(false);

      if (typeof window !== 'undefined' && window.location.pathname !== targetPath) {
        window.history.pushState({}, '', targetPath);
      }
      setCurrentPath(targetPath);

      if (scrollSection && scrollSection !== 'home') {
        setPendingScrollSection(scrollSection);
      } else {
        setPendingScrollSection(null);
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'auto' });
        }
      }
    },
    [currentView]
  );

  // Execute deferred scroll when navigating back to a homepage section from a subpage
  useEffect(() => {
    if (!pendingScrollSection || route.type !== 'home' || currentView !== 'public') return;
    const timer = window.setTimeout(() => {
      const el = document.getElementById(pendingScrollSection);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
      setPendingScrollSection(null);
    }, 60);
    return () => window.clearTimeout(timer);
  }, [pendingScrollSection, route.type, currentView]);

  // Direct Firestore slug resolution for deep links not matched in initial array
  useEffect(() => {
    setResolvedPropertyFallback(null);
    setResolvedBuildingFallback(null);
    setResolvedNeighborhoodFallback(null);
    setAttemptedLookupPath(null);
  }, [currentPath]);

  useEffect(() => {
    if (isLoading || route.type === 'home' || route.type === 'not-found') {
      setIsResolvingRoute(false);
      return;
    }

    const alreadyMatched =
      (route.type === 'property' && Boolean(findApprovedPropertyBySlug(approvedListings, route.slug))) ||
      (route.type === 'building' && Boolean(findBuildingBySlug(publicBuildings, route.slug))) ||
      (route.type === 'neighborhood' && Boolean(findNeighborhoodBySlug(publicLocations, route.slug)));

    if (alreadyMatched || attemptedLookupPath === currentPath) {
      setIsResolvingRoute(false);
      return;
    }

    let cancelled = false;
    setIsResolvingRoute(true);

    (async () => {
      try {
        if (route.type === 'property') {
          const docMatch = await getPropertyBySlug(route.slug);
          if (!cancelled) setResolvedPropertyFallback(docMatch);
        } else if (route.type === 'building') {
          const docMatch = await getBuildingBySlug(route.slug);
          if (!cancelled) setResolvedBuildingFallback(docMatch);
        } else if (route.type === 'neighborhood') {
          const docMatch = await getNeighborhoodBySlug(route.slug);
          if (!cancelled) setResolvedNeighborhoodFallback(docMatch);
        }
      } finally {
        if (!cancelled) {
          setAttemptedLookupPath(currentPath);
          setIsResolvingRoute(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    currentPath,
    isLoading,
    route,
    approvedListings,
    publicBuildings,
    publicLocations,
    attemptedLookupPath,
  ]);

  // Apply Home SEO when rendering homepage
  useEffect(() => {
    if (currentView !== 'public' || route.type !== 'home') return;
    const brand = siteSettings.siteName?.trim() || 'Cebu Prime Properties';
    const primaryHeroImage =
      siteSettings.heroSlides?.[0]?.image ||
      siteSettings.heroImages?.[0] ||
      '/assets/extracted/hero_skyline_clean.png';

    applySeoMetadata({
      title: `${brand} | Luxury Condominiums & Real Estate in Cebu`,
      description:
        siteSettings.heroSubheading ||
        'Premier Cebu real estate brokerage curating high-yield residences, sky penthouses, and coastal estates across Cebu Business Park, Cebu IT Park, and Mactan.',
      canonicalPath: '/',
      ogType: 'website',
      ogImage: primaryHeroImage,
      siteName: brand,
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'RealEstateAgent',
        name: brand,
        url: getOrigin(),
        areaServed: 'Metro Cebu, Philippines',
        address: {
          '@type': 'PostalAddress',
          streetAddress: siteSettings.officeAddress || 'Cebu Business Park, Cebu City',
          addressLocality: 'Cebu City',
          addressRegion: 'Cebu',
          addressCountry: 'PH',
        },
      },
    });
  }, [currentView, route.type, siteSettings]);

  const toggleFavorite = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleTabChange = (tab: NavTabId) => {
    setActiveTab(tab);
    if (route.type !== 'home' || currentView !== 'public') {
      navigateTo('/', tab);
      return;
    }

    if (tab === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
    if (route.type !== 'home') {
      navigateTo('/', 'properties');
      return;
    }
    const el = document.getElementById('properties');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSelectPublicProperty = (property: PropertyDoc) => {
    navigateTo(buildPropertyPath(property));
  };

  const handleSelectNeighborhood = (neighborhood: LocationHighlight) => {
    navigateTo(buildNeighborhoodPath(neighborhood));
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
    if (resolvedPropertyFallback?.propertyId === updated.propertyId) {
      setResolvedPropertyFallback(updated);
    }
  };

  const handlePropertyDeleted = (propertyId: string) => {
    setProperties((prev) => prev.filter((p) => p.propertyId !== propertyId));
    if (selectedProperty?.propertyId === propertyId) {
      setSelectedProperty(null);
    }
  };

  const handleBuildingAdded = (newBld: BuildingDoc) => {
    setBuildings((prev) =>
      prev.some((b) => b.buildingId === newBld.buildingId)
        ? prev.map((b) => (b.buildingId === newBld.buildingId ? newBld : b))
        : [...prev, newBld]
    );
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
    } else if (isEditor) {
      setCurrentView('editor');
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
          locations={locations}
          siteSettings={siteSettings}
          onPropertyUpdated={handlePropertyUpdated}
          onPropertyDeleted={handlePropertyDeleted}
          onBuildingAdded={handleBuildingAdded}
          onBuildingDeleted={handleBuildingDeleted}
          onLocationsUpdated={setLocations}
          onSettingsUpdated={setSiteSettings}
          onViewPublicSite={() => setCurrentView('public')}
          onSelectPropertyPreview={setSelectedProperty}
          onOpenPublicPath={(path) => navigateTo(path)}
        />

        {/* Staff Quick Preview Modal */}
        <PropertyModal
          property={selectedProperty}
          onClose={() => setSelectedProperty(null)}
          isFavorite={selectedProperty ? favorites.includes(selectedProperty.propertyId) : false}
          otherReferencedImageUrls={allReferencedImageUrls}
          onToggleFavorite={toggleFavorite}
          onInquireAboutProperty={handleOpenInquireWithProperty}
          onPropertyUpdated={handlePropertyUpdated}
        />
      </>
    );
  }

  // If in Editor view
  if (currentView === 'editor' && isEditor) {
    return (
      <>
        <EditorDashboard
          properties={properties}
          buildings={buildings}
          locations={locations}
          onPropertyUpdated={handlePropertyUpdated}
          onBuildingAdded={handleBuildingAdded}
          onLocationsUpdated={setLocations}
          onViewPublicSite={() => setCurrentView('public')}
          onSelectPropertyPreview={setSelectedProperty}
          onOpenPublicPath={(path) => navigateTo(path)}
        />

        {/* Staff Quick Preview Modal */}
        <PropertyModal
          property={selectedProperty}
          onClose={() => setSelectedProperty(null)}
          isFavorite={selectedProperty ? favorites.includes(selectedProperty.propertyId) : false}
          otherReferencedImageUrls={allReferencedImageUrls}
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
          locations={locations}
          onPropertyUpdated={handlePropertyUpdated}
          onPropertyDeleted={handlePropertyDeleted}
          onViewPublicSite={() => setCurrentView('public')}
          onSelectPropertyPreview={setSelectedProperty}
        />

        {/* Staff Quick Preview Modal */}
        <PropertyModal
          property={selectedProperty}
          onClose={() => setSelectedProperty(null)}
          isFavorite={selectedProperty ? favorites.includes(selectedProperty.propertyId) : false}
          otherReferencedImageUrls={allReferencedImageUrls}
          onToggleFavorite={toggleFavorite}
          onInquireAboutProperty={handleOpenInquireWithProperty}
          onPropertyUpdated={handlePropertyUpdated}
        />
      </>
    );
  }

  // Resolve route entity synchronously from loaded records or async slug fallback
  const routeProperty =
    route.type === 'property'
      ? findApprovedPropertyBySlug(approvedListings, route.slug) ||
        (resolvedPropertyFallback && findApprovedPropertyBySlug([resolvedPropertyFallback], route.slug))
      : null;

  const routeBuilding: BuildingDoc | null =
    route.type === 'building'
      ? findBuildingBySlug(publicBuildings, route.slug) ||
        (resolvedBuildingFallback && isBuildingPubliclyVisible(resolvedBuildingFallback)
          ? findBuildingBySlug([resolvedBuildingFallback], route.slug)
          : null)
      : null;

  const routeNeighborhood: LocationHighlight | null =
    route.type === 'neighborhood'
      ? findNeighborhoodBySlug(publicLocations, route.slug) ||
        (resolvedNeighborhoodFallback && isNeighborhoodPubliclyVisible(resolvedNeighborhoodFallback)
          ? findNeighborhoodBySlug([resolvedNeighborhoodFallback], route.slug)
          : null)
      : null;

  const filteredApproved = applyPropertyFilters(approvedListings, filter);
  const featuredProperties = filteredApproved.filter((p) => p.featured).slice(0, 4);
  const homepageProperties =
    featuredProperties.length > 0 ? featuredProperties : filteredApproved.slice(0, 4);

  const isWaitingForSubpageResolution =
    route.type !== 'home' &&
    route.type !== 'not-found' &&
    (isLoading || isResolvingRoute) &&
    ((route.type === 'property' && !routeProperty) ||
      (route.type === 'building' && !routeBuilding) ||
      (route.type === 'neighborhood' && !routeNeighborhood));

  return (
    <div className="min-h-screen bg-[#F8F7F3] flex flex-col selection:bg-[#C6A878]/30 selection:text-[#17243B]">
      {route.type === 'home' ? (
        <>
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
              userRole={isSuperAdmin ? 'superadmin' : isEditor ? 'editor' : isAgent ? 'agent' : null}
              userDisplayName={profile?.displayName || user?.displayName}
              siteSettings={siteSettings}
            />

            <Hero
              onExploreClick={() => {
                const el = document.getElementById('properties');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              settings={siteSettings}
            />
          </div>

          {/* Floating Pill Search Bar Overlapping Hero/Content Boundary */}
          <FloatingSearchBar
            filter={filter}
            onFilterChange={setFilter}
            onSearchExecute={handleSearchExecute}
            locations={publicLocations}
          />

          {/* Main Content Sections */}
          <main className="flex-1">
            {/* Featured Properties Section (Powered dynamically by Firestore) */}
            <FeaturedProperties
              properties={homepageProperties}
              totalApprovedCount={filteredApproved.length}
              favorites={favorites}
              onToggleFavorite={toggleFavorite}
              onSelectProperty={handleSelectPublicProperty}
              onViewAllClick={() => setAllPropertiesViewOpen(true)}
              isLoading={isLoading}
            />

            {/* Explore Neighborhood & Areas Section */}
            <ExploreLocations
              locations={publicLocations}
              isLoading={isLoading}
              onSelectLocation={handleLocationSelect}
              onSelectNeighborhood={handleSelectNeighborhood}
              onBrowseAllLocations={() => {
                setFilter(DEFAULT_FILTER);
                setAllPropertiesViewOpen(true);
              }}
            />

            {/* About Us & Proven Track Record */}
            <AboutSection />

            {/* Private Client Inquiries & Contact Form */}
            <ContactSection
              initialPropertyInterest={inquiryPropertyTitle}
              properties={approvedListings}
              siteSettings={siteSettings}
            />
          </main>
        </>
      ) : (
        <>
          {/* Dedicated Subpage Header */}
          <div className="bg-[#17243B] border-b border-white/10">
            <Header
              activeTab={
                route.type === 'neighborhood'
                  ? 'locations'
                  : route.type === 'property' || route.type === 'building'
                  ? 'properties'
                  : 'home'
              }
              onTabChange={handleTabChange}
              onOpenSearch={() => setSearchModalOpen(true)}
              onOpenInquire={() =>
                handleOpenInquireWithProperty(
                  routeProperty?.propertyTitle ||
                    routeBuilding?.buildingName ||
                    routeNeighborhood?.name ||
                    'Cebu Prime Advisory'
                )
              }
              favoriteCount={favorites.length}
              onOpenFavorites={() => setFavoritesDrawerOpen(true)}
              onOpenPortal={handlePortalClick}
              userRole={isSuperAdmin ? 'superadmin' : isEditor ? 'editor' : isAgent ? 'agent' : null}
              userDisplayName={profile?.displayName || user?.displayName}
              siteSettings={siteSettings}
            />
          </div>

          {isWaitingForSubpageResolution ? (
            <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-14 sm:py-20">
              <div className="bg-white rounded-3xl border border-slate-200 p-10 sm:p-16 text-center space-y-4 shadow-sm">
                <Loader2 className="w-8 h-8 text-[#C6A878] animate-spin mx-auto" />
                <p className="text-sm font-medium text-slate-600">
                  Loading residence and district records from Cebu Prime Database...
                </p>
              </div>
            </main>
          ) : route.type === 'property' && routeProperty ? (
            <PropertyDetailPage
              property={routeProperty}
              allProperties={approvedListings}
              buildings={publicBuildings}
              neighborhoods={publicLocations}
              favorites={favorites}
              siteSettings={siteSettings}
              otherReferencedImageUrls={allReferencedImageUrls}
              onToggleFavorite={toggleFavorite}
              onNavigate={(path) => navigateTo(path)}
              onPropertyUpdated={handlePropertyUpdated}
            />
          ) : route.type === 'building' && routeBuilding ? (
            <BuildingDetailPage
              building={routeBuilding}
              allProperties={approvedListings}
              allBuildings={publicBuildings}
              neighborhoods={publicLocations}
              siteSettings={siteSettings}
              onNavigate={(path) => navigateTo(path)}
              onOpenInquiryModal={handleOpenInquireWithProperty}
            />
          ) : route.type === 'neighborhood' && routeNeighborhood ? (
            <NeighborhoodDetailPage
              neighborhood={routeNeighborhood}
              allProperties={approvedListings}
              allBuildings={publicBuildings}
              allNeighborhoods={publicLocations}
              siteSettings={siteSettings}
              onNavigate={(path) => navigateTo(path)}
              onOpenInquiryModal={handleOpenInquireWithProperty}
            />
          ) : (
            <NotFoundPage
              missingPath={currentPath}
              onNavigateHome={() => navigateTo('/', 'home')}
              onBrowseProperties={() => {
                navigateTo('/');
                setAllPropertiesViewOpen(true);
              }}
            />
          )}
        </>
      )}

      {/* Footer */}
      <Footer
        onNavClick={handleTabChange}
        onSelectLocation={handleLocationSelect}
        onSelectNeighborhood={handleSelectNeighborhood}
        locations={publicLocations}
        siteSettings={siteSettings}
      />

      {/* All Properties Gallery & Filter View */}
      <AllPropertiesView
        isOpen={allPropertiesViewOpen}
        onClose={() => setAllPropertiesViewOpen(false)}
        properties={filteredApproved}
        buildings={publicBuildings}
        locations={publicLocations}
        filter={filter}
        onFilterChange={setFilter}
        onResetFilter={() => setFilter(DEFAULT_FILTER)}
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
        onSelectProperty={handleSelectPublicProperty}
      />

      {/* Inquiry Dialog Modal */}
      <InquiryModal
        isOpen={inquiryModalOpen}
        onClose={() => setInquiryModalOpen(false)}
        defaultProperty={inquiryPropertyTitle}
        properties={approvedListings}
        siteSettings={siteSettings}
      />

      {/* Search Overlay Modal */}
      <SearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        properties={approvedListings}
        onSelectProperty={handleSelectPublicProperty}
      />

      {/* Saved Properties Drawer */}
      <FavoritesDrawer
        isOpen={favoritesDrawerOpen}
        onClose={() => setFavoritesDrawerOpen(false)}
        favorites={favorites}
        properties={approvedListings}
        onRemoveFavorite={toggleFavorite}
        onSelectProperty={handleSelectPublicProperty}
        onInquireNow={() => handleOpenInquireWithProperty('Saved Portfolio')}
      />

      {/* Staff & Agent Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={() => {
          if (isSuperAdmin) setCurrentView('superadmin');
          else if (isEditor) setCurrentView('editor');
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
