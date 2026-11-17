import React, {useEffect, useRef, useState} from 'react';
import {MapPin, Navigation, Car, ArrowUpRight, LocateFixed, RotateCcw, Pause, Play} from 'lucide-react';
import {KINGS, ADDRESS, OVERVIEW, MAP_KEY, EMBED, loadGoogleMaps, mapStyles, addPin, routeSummary, navigationLink} from './kings-map';
import './kings-directions.css';

export default function KingsDirections() {
  const section = useRef(null), canvas = useRef(null), searchHost = useRef(null), api = useRef(null);
  const selection = useRef(null), sequence = useRef(0), mounted = useRef(true), cleanupRoute = useRef(()=>{}), animation = useRef(null);
  const [near, setNear] = useState(false), [status, setStatus] = useState('idle'), [error, setError] = useState('');
  const [selectedName, setSelectedName] = useState(''), [result, setResult] = useState(null), [paused,setPaused] = useState(false), [animating,setAnimating] = useState(false), [reduced,setReduced] = useState(false);
  useEffect(() => {
    mounted.current = true;
    const observer = new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setNear(true);observer.disconnect();}}, {rootMargin:'350px'});
    observer.observe(section.current);
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const motion = ()=>setReduced(media.matches); motion(); media.addEventListener('change',motion);
    return ()=>{mounted.current=false;sequence.current++;observer.disconnect();media.removeEventListener('change',motion);cleanupRoute.current();};
  }, []);
  useEffect(()=>{
    if (!near || !MAP_KEY) return;
    let stopped=false, widget, destinationPin, errorListener;
    setStatus('loading');
    (async()=>{
      try {
        const maps=await loadGoogleMaps();
        const [{Map}, {Route}, {PlaceAutocompleteElement}]=await Promise.all([maps.importLibrary('maps'),maps.importLibrary('routes'),maps.importLibrary('places')]);
        if(stopped) return;
        const map=new Map(canvas.current,{center:KINGS,zoom:12,styles:mapStyles,gestureHandling:'cooperative',mapTypeControl:false,streetViewControl:false,fullscreenControl:true});
        map.fitBounds(OVERVIEW,36);
        destinationPin=addPin(maps,map,KINGS,'KINGS Café',true);
        widget=new PlaceAutocompleteElement({includedRegionCodes:['au'],locationBias:{center:KINGS,radius:50000}});
        widget.placeholder='Enter your starting address';
        widget.setAttribute('aria-label','Your starting address');
        widget.addEventListener('input',()=>{selection.current=null;setSelectedName('');sequence.current++;setResult(null);cleanupRoute.current();setError('');setStatus('ready');});
        widget.addEventListener('gmp-select',async({placePrediction})=>{
          const id=++sequence.current;
          setStatus('selecting');setError('');selection.current=null;setResult(null);cleanupRoute.current();
          try {
            const place=placePrediction.toPlace();await place.fetchFields({fields:['formattedAddress','location']});
            if(stopped || id!==sequence.current) return;
            if(!place.location) throw new Error();
            selection.current={origin:place.location.toJSON(),label:place.formattedAddress||'Selected address'};
            setSelectedName(selection.current.label);setStatus('ready');
          }catch{if(!stopped && id===sequence.current){setError('We couldn’t find that address. Please choose another suggestion.');setStatus('ready');}}
        });
        errorListener=()=>{setError('Address suggestions are unavailable. Try a nearby starting point below.');};
        widget.addEventListener('gmp-error',errorListener);
        searchHost.current.replaceChildren(widget);
        api.current={maps,map,Route,widget};setStatus('ready');
      } catch {if(!stopped){setStatus('failed');setError('The route planner couldn’t connect. You can still view our location below or open directions in Google Maps.');}}
    })();
    return ()=>{stopped=true;api.current=null;widget?.remove();destinationPin?.setMap(null);cleanupRoute.current();};
  },[near]);
  useEffect(()=>{
    const current=animation.current;
    if(current) current.hold=paused||reduced;
  },[paused,reduced]);

  async function getRoute(origin, label) {
    if(!api.current) return;
    api.current.widget.value=label;
    const id=++sequence.current;
    setStatus('routing');setError('');setResult(null);setPaused(false);setAnimating(!reduced);cleanupRoute.current();
    try {
      const {maps,map,Route}=api.current;
      const {routes}=await Route.computeRoutes({origin,destination:KINGS,travelMode:'DRIVING',routingPreference:'TRAFFIC_AWARE',fields:['path','distanceMeters','durationMillis','warnings']});
      if(!mounted.current || id!==sequence.current) return;
      const route=routes?.[0], summary=routeSummary(route);
      const glow=new maps.Polyline({map,path:route.path,strokeColor:'#ed994f',strokeOpacity:.18,strokeWeight:15,clickable:false});
      const line=new maps.Polyline({map,path:route.path,strokeColor:'#f2a361',strokeOpacity:1,strokeWeight:5,clickable:false,zIndex:3});
      const start=addPin(maps,map,route.path[0],'Your starting point');
      const bounds=new maps.LatLngBounds();route.path.forEach(p=>bounds.extend(p));map.fitBounds(bounds,60);
      const state={hold:reduced,elapsed:0,frame:0,last:null};animation.current=state;
      const symbol={path:maps.SymbolPath.CIRCLE,scale:5,fillColor:'#fff2de',fillOpacity:1,strokeColor:'#d68448',strokeWeight:2};
      const step=(time)=>{if(state.last!==null && !state.hold && !document.hidden) state.elapsed+=Math.min(time-state.last,80);state.last=time;line.set('icons',[{icon:symbol,offset:Math.min(state.elapsed/8000*100,100)+'%'}]);if(state.elapsed<8000)state.frame=requestAnimationFrame(step);else setAnimating(false);};
      if(!reduced)state.frame=requestAnimationFrame(step);
      cleanupRoute.current=()=>{cancelAnimationFrame(state.frame);glow.setMap(null);line.setMap(null);start.setMap(null);animation.current=null;};
      setResult({...summary,label,origin,warnings:route.warnings||[]});setStatus('ready');
    } catch {if(mounted.current && id===sequence.current){setError('We couldn’t find a driving route from that starting point. Try a nearby street address, or open directions in Google Maps.');setStatus('ready');}}
  }
  function useLocation() {
    if(!navigator.geolocation){setError('Your browser doesn’t support location sharing. Please enter your address instead.');return;}
    const id=++sequence.current;setStatus('locating');setError('');setResult(null);cleanupRoute.current();
    navigator.geolocation.getCurrentPosition(position=>{
      if(!mounted.current||id!==sequence.current)return;
      const origin={lat:position.coords.latitude,lng:position.coords.longitude};selection.current={origin,label:'Your current location'};setSelectedName('Your current location');getRoute(origin,'Your current location');
    },reason=>{if(mounted.current&&id===sequence.current){setStatus('ready');setError(reason.code===1?'Location access wasn’t allowed. You can enter your address instead.':'We couldn’t find your location. Please enter your address instead.');}}, {enableHighAccuracy:false,timeout:12000,maximumAge:60000});
  }
  function reset() {sequence.current++;cleanupRoute.current();setResult(null);setError('');setStatus('ready');api.current?.map.fitBounds(OVERVIEW,36);}
  const ready=!!api.current, busy=['loading','routing','locating','selecting'].includes(status);
  const fallback=!MAP_KEY||status==='failed';
  return <section className="k-directions e-section" id="directions" ref={section} aria-labelledby="directions-heading">
    <div className="k-directions-heading"><div><span className="e-kicker">Find Us in Labrador</span><h2 id="directions-heading">Get Directions To Kings Cafe</h2></div><p>You’ll find us on Frank Street in Labrador, around 6.5 km by road from Cavill Avenue in Surfers Paradise. Check your drive time below, then settle in for breakfast and a coffee.</p></div>
    <div className="k-directions-layout">
      <div className="k-route-panel">
        <div className="k-route-destination"><MapPin size={23}/><div><strong>KINGS Café</strong><span>{ADDRESS}</span></div></div>
        <h3>How far is your next breakfast?</h3>
        <p>Choose where you’re coming from to see your driving route, distance and estimated travel time right here.</p>
        <form onSubmit={e=>{e.preventDefault();if(selection.current)getRoute(selection.current.origin,selection.current.label);else setError('Choose an address from the suggestions first.');}}>
          <label id="k-origin-label">Your starting address</label>
          <div className="k-address-search" aria-labelledby="k-origin-label"><div ref={searchHost}/>{!ready&&<input aria-label="Your starting address" placeholder="Enter your starting address" disabled/>}</div>
          {selectedName&&<span className="k-selected-address">From: {selectedName}</span>}
          <button className="k-route-submit" type="submit" disabled={!ready||busy}>{busy?'Finding your way…':'Show My Route'}<Navigation size={17}/></button>
        </form>
        <button className="k-use-location" onClick={useLocation} disabled={!ready||busy}><LocateFixed size={17}/> Use My Location</button>
        <div className="k-quick-starts"><span>Coming from nearby?</span>{[['Surfers Paradise','Cavill Avenue, Surfers Paradise QLD'],['Southport','Australia Fair, Southport QLD'],['Main Beach','Tedder Avenue, Main Beach QLD']].map(([name,origin])=><button key={name} disabled={!ready||busy} onClick={()=>{selection.current={origin,label:name};setSelectedName(name);getRoute(origin,name);}}>{name}<ArrowUpRight size={13}/></button>)}</div>
        {!MAP_KEY&&<p className="k-route-note">The on-page route planner is being connected. You can explore the map or open Google Maps for directions.</p>}
        {error&&<p className="k-route-error" role="alert">{error}</p>}
        <div aria-live="polite" aria-atomic="true">{result&&<div className="k-route-result"><span><Car size={17}/> Driving from {result.label}</span><div><strong>{result.duration}<small>estimated drive</small></strong><strong>{result.distance}<small>via this route</small></strong></div><p>Estimated for departure now. Traffic and road conditions can change.</p>{result.warnings.map(w=><p key={w}>{w}</p>)}</div>}</div>
        <p className="k-route-privacy">Google processes your starting point to calculate the route. KINGS doesn’t save your address or location.</p>
        <a className="k-external-directions" href={navigationLink(result?.origin)} target="_blank" rel="noreferrer">Open in Google Maps <ArrowUpRight size={15}/></a>
      </div>
      <div className="k-map-column"><div className="k-map-toolbar"><span><span className="k-map-dot"/> Labrador · Gold Coast</span>{result&&<div>{!reduced&&animating&&<button onClick={()=>setPaused(!paused)} aria-label={paused?'Resume route animation':'Pause route animation'}>{paused?<Play size={16}/>:<Pause size={16}/>}</button>}<button onClick={reset}><RotateCcw size={14}/> Reset map</button></div>}</div><div className="k-map-frame"><div className="k-google-map" ref={canvas} hidden={fallback}/>{fallback&&near&&<iframe src={EMBED} title="KINGS Café location in Labrador on Google Maps" loading="lazy" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>}{!fallback&&status==='loading'&&<div className="k-map-loading" role="status">Loading the Gold Coast map…</div>}</div><div className="k-map-caption"><MapPin size={16}/><span>Your destination: <strong>KINGS Café, 10A Frank Street</strong></span></div></div>
    </div>
  </section>;
}
