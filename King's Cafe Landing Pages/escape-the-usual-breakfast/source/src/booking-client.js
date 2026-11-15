// Every campaign can send this same shape to the central booking endpoint.
export function attribution(location) {
  const params=new URLSearchParams(location.search);
  const result={campaign:'escape-the-usual-breakfast',landing_path:location.pathname};
  for(const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','gbraid','wbraid','fbclid']) {
    const value=params.get(key);if(value)result[key]=value.slice(0,500);
  }
  return result;
}
export async function sendBooking(endpoint,payload,key) {
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),20000);
  try {
    const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify(payload),signal:controller.signal});
    const result=await response.json();
    if(!response.ok) throw Error(result.error||'Your request could not be sent. Please try again or call 0436 340 324.');
    if(typeof result.id!=='string'||!['pending','confirmed','arrived','cancelled','no_show'].includes(result.status)) throw Error('We could not verify your request. Please retry or call 0436 340 324.');
    return result;
  } catch(error) {
    if(error.name==='AbortError')throw Error('The connection timed out. Please retry with the same details so we can check your request, or call 0436 340 324.');
    throw error;
  } finally {clearTimeout(timeout);}
}
