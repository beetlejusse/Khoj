'use client';
import axios from 'axios';
import {AdvancedMarker, APIProvider, Map, Marker, Pin} from '@vis.gl/react-google-maps';
import {useState, useEffect, useRef} from 'react';
import {MapPlaceDetails, Places} from "../types";
import { PLACE_TYPE_COLORS} from '../lib/placesTypes';
import { useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';

export default function MapPage(){
  const { isSignedIn } = useUser();
  const searchParams = useSearchParams();
  const placeIdFromUrl = searchParams.get('place');
  const mapRef = useRef<google.maps.Map | null>(null);
  
  const [userLocation, setUserLocation]= useState<{lat: number, lng: number}>({lat: 28.6129, lng:77.2295});
  const [initialCenter, setInitialCenter] = useState<{lat: number, lng: number}>({lat: 28.6129, lng:77.2295});
  const [initialZoom, setInitialZoom] = useState(12);
  const [places, setPlaces]=useState([]);
  const [selectedPlace, setSelectedPlace]= useState<Places | null>(null);
  const [placeDetails, setPlaceDetails] = useState<MapPlaceDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [planningMode, setPlanningMode] = useState(false);
  const [selectedPlaces, setSelectedPlaces] = useState<string[]>([]);
  const [itinerary, setItinerary] = useState<any>(null);
  const [generatingRoute, setGeneratingRoute] = useState(false);
   
  //this is to get the user's location
  useEffect(()=>{
    navigator.geolocation.getCurrentPosition((position)=>{
      setUserLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude
      });
    })
  },[]); //no dependency array so runs only once to get the users location and save them in the state variable

  //this is to get the tagged places
  useEffect(()=>{
    async function getPlaces(){
      const response=await axios.get("api/places");
        setPlaces(response.data);
      
      if (placeIdFromUrl) {
        const place = response.data.find((place: Places) => place.placeId === placeIdFromUrl);
        if (place) {
          setInitialCenter({lat: place.lat, lng: place.lng});
          setInitialZoom(15);
          setSelectedPlace(place);
        }
      }
    };
    getPlaces();
  }, [placeIdFromUrl]);  

  // Fetch place details when a place is selected
  useEffect(()=>{
    if(!selectedPlace) {
      setSidebarOpen(false);
      return;
    }

    const place = selectedPlace; // Capture for async to ensure the current place details shown is for the selected one

    async function fetchDetails() {

      console.log(selectedPlace);

      setLoadingDetails(true);
      setSidebarOpen(true);

      try {
        const response = await axios.get(`/api/places/${place.placeId}`);
        setPlaceDetails(response.data);

      } catch (error) {
        
        console.error("Failed to fetch place details:", error);

        setPlaceDetails({
          placeId: place.placeId,
          displayName: place.displayName,
          formattedAddress: place.formattedAddress,
        });
      }
      setLoadingDetails(false);
    }

    fetchDetails();
  },[selectedPlace]);

  const closeSidebar= ()=>{
    setSidebarOpen(false);
    setTimeout(()=>{
      setSelectedPlace(null);
      setPlaceDetails(null);
    }, 300)
  }

  const togglePlaceSelection = (placeId: string) => {
    setSelectedPlaces(prev => 
      prev.includes(placeId) 
        ? prev.filter(id => id !== placeId)
        : [...prev, placeId]
    );
  };

  const generateRoute = async () => {
    if (selectedPlaces.length < 2) return;
    
    setGeneratingRoute(true);
    try {
      const response = await axios.post('/api/itinerary', {
        placeIds: selectedPlaces,
        startTime: '09:00'
      });
      setItinerary(response.data);
      setSidebarOpen(true);
    } catch (error) {
      console.error('Failed to generate route:', error);
    }
    setGeneratingRoute(false);
  };

  const exitPlanning = () => {
    setPlanningMode(false);
    setSelectedPlaces([]);
    setItinerary(null);
  };

  return(
    <div className='relative w-full h-full overflow-hidden'>
      {planningMode && (
        <div style={{position:'absolute',top:'16px',left:'50%',transform:'translateX(-50%)',zIndex:50,background:'#fff',color:'#000',padding:'12px 24px',borderRadius:'8px',boxShadow:'0 2px 8px rgba(0,0,0,0.15)',display:'flex',gap:'16px',alignItems:'center'}}>
          <span>{selectedPlaces.length} selected</span>
          <button onClick={exitPlanning} style={{padding:'6px 12px',border:'1px solid #ddd',borderRadius:'4px',background:'#fff'}}>Cancel</button>
          <button onClick={generateRoute} disabled={selectedPlaces.length < 2 || generatingRoute} style={{padding:'6px 12px',background:selectedPlaces.length < 2 ? '#ccc' : '#000',color:'#fff',borderRadius:'4px',border:'none',cursor:selectedPlaces.length < 2 ? 'not-allowed' : 'pointer'}}>
            {generatingRoute ? 'Generating...' : 'Chart Route'}
          </button>
        </div>
      )}

      <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
        <Map
        key={`${initialCenter.lat}-${initialCenter.lng}`}
        mapId={process.env.NEXT_PUBLIC_GOOGLE_MAP_ID!} 
        defaultCenter={initialCenter}
        defaultZoom={initialZoom}
        style={{width: '100%', height: '100%'}}
        gestureHandling='greedy'
        disableDefaultUI= {false}>
        
        <Marker position={userLocation}/>

        {places.map((place:Places)=> {
          const isSelected = selectedPlaces.includes(place.placeId);
          const routeIndex = itinerary?.route.indexOf(place.placeId);
          
          return(
            <AdvancedMarker 
            key={place.placeId} 
            position={{lat: place.lat, lng: place.lng}} 
            onClick={()=>{
              if (planningMode) {
                togglePlaceSelection(place.placeId);
              } else {
                setSelectedPlace(place);
              }
            }}>
              {planningMode ? (
                <div style={{position:'relative'}}>
                  <Pin
                    background={isSelected ? '#4CAF50' : PLACE_TYPE_COLORS[place.type as keyof (typeof PLACE_TYPE_COLORS)] ?? "#95A5A6"}
                    glyphColor='white'
                    scale={isSelected ? 1.3 : 1}
                  />
                  {isSelected && (
                    <div style={{position:'absolute',top:'-8px',right:'-8px',background:'#fff',borderRadius:'50%',width:'20px',height:'20px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:'bold',border:'2px solid #4CAF50'}}>
                      ✓
                    </div>
                  )}
                  {routeIndex !== -1 && routeIndex !== undefined && (
                    <div style={{position:'absolute',top:'-12px',left:'50%',transform:'translateX(-50%)',background:'#000',color:'#fff',borderRadius:'50%',width:'24px',height:'24px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:'bold'}}>
                      {routeIndex + 1}
                    </div>
                  )}
                </div>
              ) : (
                <Pin
                  background={PLACE_TYPE_COLORS[place.type as keyof (typeof PLACE_TYPE_COLORS)] ?? "#95A5A6"}
                  glyphColor='white'
                  scale= {selectedPlace?.placeId == place.placeId? 1.3 : 1}
                />
              )}
            </AdvancedMarker>
          )
        })};
        </Map>
      </APIProvider>
      
      {/* Overlay backdrop for mobile */}
      {sidebarOpen && (
        <div 
          className="absolute inset-0 bg-foreground/20 md:hidden z-10 transition-opacity duration-300"
          onClick={closeSidebar}
        />
      )}
      
      <div className={`
          absolute bg-background shadow-lg z-40 border-l border-border
          transition-transform duration-300 ease-in-out
          
          /* Mobile: bottom sheet taking 70% height */
          inset-x-0 bottom-0 h-[70vh] rounded-t-2xl
          ${sidebarOpen ? 'translate-y-0' : 'translate-y-full'}
          
          /* Desktop: right sidebar */
          md:inset-y-0 md:right-0 md:left-auto md:bottom-auto
          md:w-95 md:h-full md:rounded-none
          ${sidebarOpen ? 'md:translate-x-0' : 'md:translate-x-full'}
          md:translate-y-0
        `}>

          {/* header */}
          <div className='flex item-center justify-between border-b px-5 py-4 '>
            <h1> {loadingDetails ? "loading..." : placeDetails?.displayName}</h1>
            <button onClick={closeSidebar}>
              <img src="./cross.svg" className='w-5 h-5'></img>
            </button>
          </div>

          {/* content */}
          <div className="overflow-y-auto h-[calc(100%-80px)] md:h-[calc(100%-56px)]">
            {itinerary ? (
              <div style={{padding:'20px'}}>
                <div style={{marginBottom:'16px',paddingBottom:'16px',borderBottom:'1px solid #333'}}>
                  <div style={{fontSize:'18px',fontWeight:'bold',marginBottom:'8px'}}>Your Route - {itinerary.route.length} places</div>
                  <div style={{fontSize:'14px',color:'#888'}}>
                    Total: {Math.floor(itinerary.totalTime / 60)}h {itinerary.totalTime % 60}m | {(itinerary.totalDistance / 1000).toFixed(1)} km
                  </div>
                </div>
                
                {itinerary.timeline.map((item: any, idx: number) => (
                  <div key={idx} style={{marginBottom:'16px'}}>
                    {item.type === 'visit' ? (
                      <div style={{padding:'12px',background:'#1a1a1a',borderRadius:'8px'}}>
                        <div style={{fontSize:'16px',fontWeight:'bold',marginBottom:'4px'}}>{idx / 2 + 1}. {item.placeName}</div>
                        <div style={{fontSize:'14px',color:'#888',marginBottom:'4px'}}>{item.arrivalTime} - {item.departureTime}</div>
                        <div style={{fontSize:'12px',color:'#666'}}>Visit duration: {item.visitDuration} min</div>
                      </div>
                    ) : (
                      <div style={{padding:'8px 12px',fontSize:'14px',color:'#888',display:'flex',alignItems:'center',gap:'8px'}}>
                        <span>↓</span>
                        <span>{item.duration} min ({(item.distance / 1000).toFixed(1)} km)</span>
                      </div>
                    )}
                  </div>
                ))}
                
                <button onClick={exitPlanning} style={{width:'100%',padding:'12px',background:'#fff',color:'#000',borderRadius:'8px',border:'none',fontWeight:'bold',marginTop:'16px',cursor:'pointer'}}>
                  Exit Planning
                </button>
              </div>
            ) : loadingDetails ? (
              <div className="p-5 space-y-4 animate-pulse">
                <div className="h-44 bg-muted rounded-lg"/>
                <div className="h-3 bg-muted rounded w-3/4"/>
                <div className="h-3 bg-muted rounded w-1/2"/>
              </div>
            ) : placeDetails ? (
              <div className="p-5 space-y-4">
                {/* Photos - now direct URLs from API */}
                {placeDetails.photos && placeDetails.photos.length > 0 && (
                  <div className="space-y-2">
                    <div className="h-44 rounded-lg overflow-hidden bg-muted">
                      <img 
                        src={placeDetails.photos[0]}
                        alt={placeDetails.displayName}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                        }}
                      />
                    </div>
                    {placeDetails.photos.length > 1 && (
                      <div className="flex gap-2">
                        {placeDetails.photos.slice(1, 4).map((photo, i) => (
                          <div key={i} className="flex-1 h-16 rounded-md overflow-hidden bg-muted">
                            <img 
                              src={photo}
                              alt={`${placeDetails.displayName} ${i + 2}`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Rating */}
                {placeDetails.rating && (
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-400">★</span>
                    <span className="text-sm font-medium text-foreground">{placeDetails.rating.toFixed(1)}</span>
                    {placeDetails.userRatingCount && (
                      <span className="text-muted-foreground text-sm">
                        ({placeDetails.userRatingCount.toLocaleString()})
                      </span>
                    )}
                  </div>
                )}

                {/* Address */}
                <div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{placeDetails.formattedAddress}</p>
                </div>

                {/* Phone */}
                {placeDetails.phone && (
                  <a 
                    href={`tel:${placeDetails.phone}`}
                    className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                    </svg>
                    {placeDetails.phone}
                  </a>
                )}

                {/* Website */}
                {placeDetails.website && (
                  <a 
                    href={placeDetails.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                    </svg>
                    <span className="truncate">{placeDetails.website.replace(/^https?:\/\//, '')}</span>
                  </a>
                )}

                {/* Opening Hours */}
                {placeDetails.openingHours && placeDetails.openingHours.length > 0 && (
                  <details className="text-sm">
                    <summary className="text-muted-foreground cursor-pointer hover:text-foreground">Opening hours</summary>
                    <ul className="mt-2 space-y-0.5 text-muted-foreground">
                      {placeDetails.openingHours.map((day, i) => (
                        <li key={i}>{day}</li>
                      ))}
                    </ul>
                  </details>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  {isSignedIn && !planningMode && (
                    <button
                      onClick={() => {
                        setPlanningMode(true);
                        setSelectedPlaces([selectedPlace!.placeId]);
                        closeSidebar();
                      }}
                      className="flex-1 bg-foreground hover:bg-foreground/90 text-background text-center py-2.5 px-4 rounded-lg text-sm font-medium transition-colors"
                    >
                      Plan a Trip
                    </button>
                  )}
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${selectedPlace?.lat},${selectedPlace?.lng}&destination_place_id=${placeDetails.placeId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-foreground hover:bg-foreground/90 text-background text-center py-2.5 px-4 rounded-lg text-sm font-medium transition-colors"
                  >
                    Directions
                  </a>
                  <a
                    href={`https://www.google.com/maps/place/?q=place_id:${placeDetails.placeId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 border border-border hover:bg-accent text-foreground text-center py-2.5 px-4 rounded-lg text-sm font-medium transition-colors"
                  >
                    View on Maps
                  </a>
                </div>
              </div>
            ) : null}
          </div>

      </div>
  </div>
  );
}