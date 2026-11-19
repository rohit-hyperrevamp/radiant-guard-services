export function checkInMapUrl(lat:number|null,lng:number|null) {
  if(lat===null || lng===null || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng)) || Math.abs(Number(lat))>90 || Math.abs(Number(lng))>180) return null;
  return `https://www.google.com/maps?q=${Number(lat)},${Number(lng)}`;
}
export function distinctPresentPeople(entries:Array<{candidate_id:string;code:string;ot_hours:number}>,presentCodes:Set<string>) {
  return new Set(entries.filter(e=>presentCodes.has(e.code)||Number(e.ot_hours)>0).map(e=>e.candidate_id)).size;
}
