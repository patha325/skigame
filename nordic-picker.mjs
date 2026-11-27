import {ResortMap} from './map.js';
import {loadNordicCatalog,loadArea} from './resorts.mjs';
const $=id=>document.getElementById(id);
export class NordicPicker{
  constructor(onRide){this.onRide=onRide;this.serial=0;this.selected=null;
    $('nordic-ride').onclick=()=>{if(this.selected&&$('nordic-run').value)this.onRide(this.selected,$('nordic-run').value);};
    $('nordic-run').onchange=()=>this.map?.showArea(this.area,$('nordic-run').value);
  }
  async open(){
    if(!this.catalog){
      try{this.catalog=await loadNordicCatalog();this.map=new ResortMap(this.catalog,r=>this.select(r),id=>{$('nordic-run').value=id;this.map.showArea(this.area,id);});
        $('nordic-count').textContent=`${this.catalog.areas} Nordic area records · ${this.catalog.areasWithRuns} with mapped runs`;
      }catch(e){$('nordic-count').textContent=e.message;return;}
    }
    requestAnimationFrame(()=>this.map.map.invalidateSize());
  }
  async select(record){
    const serial=++this.serial;this.selected=record;$('nordic-ride').disabled=true;$('nordic-run').replaceChildren();
    $('selected-name').textContent=record.name;$('selected-country').textContent=this.catalog.countries[record.country];
    $('selected-stats').textContent=record.runCount+' slope segments · '+record.liftCount+' lifts';$('selection-note').textContent='Loading mapped slopes…';
    try{
      const area=await loadArea(record);if(serial!==this.serial)return;this.area=area;
      for(const r of [...area.runs].filter(r=>r.length>=10).sort((a,b)=>(a.name||a.ref||'').localeCompare(b.name||b.ref||''))){
        const o=document.createElement('option');o.value=r.id;o.textContent=`${r.name||r.ref||'Mapped slope'} · ${r.difficulty||'ungraded'} · ${r.length} m`;$('nordic-run').append(o);
      }
      const preferred=area.runs.find(r=>r.length>600&&r.drop>65&&r.difficulty==='easy')||area.runs.find(r=>r.length>=10);
      if(preferred)$('nordic-run').value=preferred.id;
      this.map.showArea(area,preferred?.id);$('nordic-ride').disabled=!preferred;
      $('selection-note').textContent=preferred?(record.cachedTerrain?'Elevation bundled · ready for offline riding':'Elevation loads online; an estimated surface is labelled if unavailable'):'Location only: no mapped downhill lines in this snapshot.';
    }catch(e){if(serial===this.serial)$('selection-note').textContent=e.message;}
  }
}
