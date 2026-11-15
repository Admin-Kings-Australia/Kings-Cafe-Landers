const $=id=>document.getElementById(id);
const labels={pending:'Awaiting confirmation',confirmed:'Confirmed',arrived:'Arrived',cancelled:'Cancelled',no_show:'No-show'};
const brisbaneToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Brisbane',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let bookings=[],followToday=true,loggedIn=false,sequence=0;
$('date').value=brisbaneToday();
function message(text){$('message').textContent=text;}
function signIn(){loggedIn=false;sequence++;bookings=[];$('list').replaceChildren();$('detail-content').replaceChildren();$('details').close();$('workspace').hidden=true;$('logout').hidden=true;$('login').hidden=false;}
async function api(path,options={}) {
  const r=await fetch(path,{...options,headers:{'Content-Type':'application/json',...options.headers}});
  const value=await r.json();
  if(r.status===401) signIn();
  if(!r.ok) throw Error(value.error||'Could not connect. Please retry.');
  return value;
}
function render(){
  const active=bookings.filter(b=>!['cancelled','no_show'].includes(b.status));
  $('total').textContent=active.length;$('guests').textContent=active.reduce((n,b)=>n+b.guests,0);
  $('pending').textContent=bookings.filter(b=>b.status==='pending').length;$('arrived').textContent=bookings.filter(b=>b.status==='arrived').length;
  $('day-label').textContent=new Intl.DateTimeFormat('en-AU',{weekday:'long',day:'numeric',month:'long',timeZone:'Australia/Brisbane'}).format(new Date($('date').value+'T12:00:00+10:00'));
  const search=$('search').value.toLowerCase();
  const shown=bookings.filter(b=>($('filter').value==='all'||b.status===$('filter').value)&&[b.name,b.email,b.phone].some(x=>x.toLowerCase().includes(search)));
  $('list').innerHTML=shown.length?shown.map(b=>`<article class="booking ${b.status}"><time>${escape(b.time)}</time><div class="guest"><h3>${escape(b.name)}</h3><small>${b.booking_count} booking${b.booking_count===1?'':'s'} on record · ${b.visit_count} attended</small>${b.notes?`<p>${escape(b.notes)}</p>`:''}</div><div class="party"><strong>${b.guests}</strong><small>${b.guests===1?'guest':'guests'}</small></div><span class="badge">${labels[b.status]}</span><div class="actions"><a href="tel:${escape(b.phone)}" aria-label="Call ${escape(b.name)}">Call ↗</a><button data-id="${b.id}">Details</button></div></article>`).join(''):`<div class="empty"><h3>${bookings.length?'No matching bookings.':'A fresh page in the book.'}</h3><p>${bookings.length?'Try another search or status.':'No bookings for this date yet. New requests will appear here automatically.'}</p></div>`;
}
async function refresh(){
  const current=++sequence, date=$('date').value;
  if(!date)return;
  try{
    const result=await api('/api/bookings?date='+date);
    if(current!==sequence)return;
    bookings=result.bookings;loggedIn=true;$('login').hidden=true;$('workspace').hidden=false;$('logout').hidden=false;
    render();$('sync').textContent='Updated '+new Intl.DateTimeFormat('en-AU',{hour:'numeric',minute:'2-digit',timeZone:'Australia/Brisbane'}).format(new Date())+' · refreshes every 30s';message('');
  }catch(error){if(current===sequence||!loggedIn){$('sync').textContent='Not connected · displayed bookings may be out of date';message(error.message);}}
}
$('login-form').onsubmit=async e=>{e.preventDefault();const button=e.currentTarget.querySelector('button');button.disabled=true;try{await api('/api/session',{method:'POST',body:JSON.stringify({password:e.currentTarget.password.value})});$('login-form').reset();await refresh();}catch(error){message(error.message)}finally{button.disabled=false}};
$('logout').onclick=async()=>{try{await api('/api/logout',{method:'POST',body:'{}'});signIn();message('Signed out.')}catch(error){message(error.message)}};
$('refresh').onclick=refresh;
$('date').onchange=()=>{followToday=$('date').value===brisbaneToday();bookings=[];$('list').textContent='Loading bookings…';for(const id of ['total','guests','pending','arrived'])$(id).textContent='—';refresh();};
for(const [id,delta] of [['previous',-1],['next',1]]) $(id).onclick=()=>{const date=new Date($('date').value+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+delta);$('date').value=date.toISOString().slice(0,10);$('date').onchange();};
$('today').onclick=()=>{$('date').value=brisbaneToday();$('date').onchange();};
$('search').oninput=render;$('filter').onchange=render;
$('close-details').onclick=()=>$('details').close();
$('list').onclick=async e=>{
  const id=e.target.closest('button[data-id]')?.dataset.id, b=bookings.find(x=>x.id===id);if(!b)return;
  $('detail-content').innerHTML=`<h2 id="detail-title">${escape(b.name)}</h2><p>${escape(b.date)} · ${escape(b.time)} · ${b.guests} guests</p><div class="contact-links"><a href="tel:${escape(b.phone)}">Call ${escape(b.phone)}</a><a href="mailto:${escape(b.email)}">${escape(b.email)}</a></div><p class="eyebrow">GUEST’S NOTE</p><p class="guest-note">${escape(b.notes||'No special requests.')}</p><form class="edit-form" id="edit-form"><label>Booking status<select name="status">${Object.entries(labels).map(([key,label])=>`<option value="${key}" ${key===b.status?'selected':''}>${label}</option>`).join('')}</select></label><label>Staff notes<textarea name="staff_notes" maxlength="2000" placeholder="Called to confirm, high chair needed…">${escape(b.staff_notes)}</textarea></label><button class="primary">Save changes</button><p id="save-message" role="status"></p></form><h3>Booking history</h3><p class="footnote">Matched by both email and phone. Bookings are separate from attended visits.</p><div id="history">Loading history…</div>`;
  $('details').showModal();
  $('edit-form').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget;const button=form.querySelector('button');button.disabled=true;try{await api('/api/bookings/'+b.id,{method:'PATCH',body:JSON.stringify({status:form.status.value,staff_notes:form.staff_notes.value,version:b.version})});$('details').close();await refresh();}catch(error){if($('save-message'))$('save-message').textContent=error.message;}finally{button.disabled=false}};
  try{const result=await api('/api/customers/'+b.customer_id);if($('history'))$('history').innerHTML=result.bookings.map(h=>`<div class="history-row">${escape(h.date)} · ${escape(h.time)} · ${h.guests} guests<span>${labels[h.status]}</span></div>`).join('');}catch(error){if($('history'))$('history').textContent=error.message;}
};
function tick(){if(!loggedIn||document.hidden)return;if(followToday&&$('date').value!==brisbaneToday()){$('date').value=brisbaneToday();}refresh();}
setInterval(tick,30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick()});refresh();
