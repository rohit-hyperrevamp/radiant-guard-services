import {describe,it,expect} from 'vitest';
import {checkInMapUrl,distinctPresentPeople} from './attendance-people-utils';
describe('attendance counts and recorded locations',()=>{
 it('counts one present employee once despite multiple duty lines',()=>{
 expect(distinctPresentPeople([{candidate_id:'one',code:'P',ot_hours:0},{candidate_id:'one',code:'P',ot_hours:0},{candidate_id:'two',code:'A',ot_hours:0}],new Set(['P']))).toBe(1);
 });
 it('counts real Extra Duty as attendance without fabricating unmarked people',()=>{
 expect(distinctPresentPeople([{candidate_id:'one',code:'OT',ot_hours:8},{candidate_id:'two',code:'A',ot_hours:0}],new Set(['P']))).toBe(1);
 });
 it('uses the recorded check-in coordinates unchanged',()=>expect(checkInMapUrl(18.46746,73.90188)).toBe('https://www.google.com/maps?q=18.46746,73.90188'));
 it('does not invent a location for missing GPS',()=>expect(checkInMapUrl(null,null)).toBeNull());
 it('rejects invalid GPS',()=>expect(checkInMapUrl(181,73)).toBeNull());
});
