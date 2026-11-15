import { DatabaseSync } from 'node:sqlite';
import { randomUUID, createHash } from 'node:crypto';
export const today = (now = new Date()) => new Intl.DateTimeFormat('en-CA', {timeZone:'Australia/Brisbane',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export const statuses = ['pending','confirmed','arrived','cancelled','no_show'];
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
export function validate(input, now = new Date()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Invalid booking.');
  const text = (key, max, required = true) => {
    const value = input[key];
    if ((value == null || value === '') && !required) return '';
    if(typeof value !== 'string' || !value.trim() || value.length > max) throw Error(`Please check ${key}.`);
    return value.trim();
  };
  const name=text('name',100), email=text('email',254).toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Error('Please enter a valid email.');
  let phone=text('phone',30).replace(/[ ()-]/g,'');
  if(/^0[23748]\d{8}$/.test(phone)) phone='+61'+phone.slice(1);
  if(!/^\+[1-9]\d{7,14}$/.test(phone)) throw Error('Please include a valid phone number and country code.');
  const date=text('date',10), time=text('time',5);
  if(!validDate(date) || date < today(now) || date > today(new Date(now.getTime()+366*86400000))) throw Error('Choose a date within the next year.');
  if(!/^(07|08|09|10|11):(00|30)$/.test(time)) throw Error('Choose a breakfast time from 7:00 to 11:30.');
  if(new Date(`${date}T${time}:00+10:00`) <= now) throw Error('Please choose a future time.');
  const guests=Number(input.guests);
  if(!Number.isInteger(guests)||guests<1||guests>12) throw Error('Choose between 1 and 12 guests.');
  const notes=text('notes',1000,false);
  const attribution={};
  for(const key of ['campaign','landing_path','utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','gbraid','wbraid','fbclid']) {
    if(input.attribution?.[key] != null) {
      if(typeof input.attribution[key] !== 'string' || input.attribution[key].length>500) throw Error('Invalid campaign information.');
      attribution[key]=input.attribution[key];
    }
  }
  return {name,email,phone,date,time,guests,notes,attribution};
}
export function openStore(path) {
  const db=new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS customers(id TEXT PRIMARY KEY,email TEXT NOT NULL,phone TEXT NOT NULL,UNIQUE(email,phone));
    CREATE TABLE IF NOT EXISTS bookings(id TEXT PRIMARY KEY,customer_id TEXT NOT NULL REFERENCES customers(id),name TEXT NOT NULL,date TEXT NOT NULL,time TEXT NOT NULL,guests INTEGER NOT NULL,notes TEXT NOT NULL,staff_notes TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'pending',attribution TEXT NOT NULL,created_at TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,request_key TEXT NOT NULL UNIQUE,payload_hash TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS booking_date ON bookings(date,time);
    CREATE INDEX IF NOT EXISTS booking_customer ON bookings(customer_id,date);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,expires INTEGER NOT NULL);`);
  return {
    db,
    create(input,key,now=new Date()) {
      if(typeof key!=='string'|| !/^[a-zA-Z0-9_-]{16,100}$/.test(key)) throw Error('A valid request key is required.');
      // Check retries before time validation: a saved request remains retrievable after its slot passes.
      const hash=createHash('sha256').update(JSON.stringify(input)).digest('hex');
      const previous=db.prepare('SELECT id,status,payload_hash FROM bookings WHERE request_key=?').get(key);
      if(previous) {
        if(previous.payload_hash!==hash) throw Error('This request key was already used. Start a new booking.');
        return {id:previous.id,status:previous.status,replayed:true};
      }
      const b=validate(input,now), id=randomUUID();
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare('INSERT OR IGNORE INTO customers VALUES(?,?,?)').run(randomUUID(),b.email,b.phone);
        const customer=db.prepare('SELECT id FROM customers WHERE email=? AND phone=?').get(b.email,b.phone);
        db.prepare('INSERT INTO bookings(id,customer_id,name,date,time,guests,notes,attribution,created_at,request_key,payload_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,customer.id,b.name,b.date,b.time,b.guests,b.notes,JSON.stringify(b.attribution),now.toISOString(),key,hash);
        db.exec('COMMIT');return {id,status:'pending',replayed:false};
      } catch(error) {db.exec('ROLLBACK');throw error;}
    },
    list(date) {
      if(!validDate(date)) throw Error('Invalid date.');
      return db.prepare(`SELECT b.id,b.customer_id,b.name,c.email,c.phone,b.date,b.time,b.guests,b.notes,b.staff_notes,b.status,b.version,
        (SELECT COUNT(*) FROM bookings h WHERE h.customer_id=b.customer_id) booking_count,
        (SELECT COUNT(*) FROM bookings h WHERE h.customer_id=b.customer_id AND h.status='arrived') visit_count
        FROM bookings b JOIN customers c ON c.id=b.customer_id WHERE b.date=? ORDER BY b.time,b.created_at`).all(date);
    },
    history(id) {return db.prepare('SELECT id,name,date,time,guests,status,notes FROM bookings WHERE customer_id=? ORDER BY date DESC,time DESC').all(id);},
    update(id,{status,staff_notes,version}) {
      if(!statuses.includes(status)||typeof staff_notes!=='string'||staff_notes.length>2000||!Number.isInteger(version)) throw Error('Invalid update.');
      return db.prepare('UPDATE bookings SET status=?,staff_notes=?,version=version+1 WHERE id=? AND version=?').run(status,staff_notes.trim(),id,version).changes>0;
    }
  };
}
