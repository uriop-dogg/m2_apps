/* Circular snapping in fixed absolute 12-EDO coordinates. */
function resolvePositionSnap(position,base,ratios,harmonic,edo){
 const wrap=x=>((x%1)+1)%1,distance=(a,b)=>Math.abs(wrap(a-b+.5)-.5);
 let c=wrap(position-base),ratio=null,best=null;
 if(harmonic)for(const k of ratios){const target=wrap(Math.log2(k)),d=distance(c,target);if(!best||d<best.d)best={c:target,ratio:k,d};}
 if(edo){const absolute=wrap(Math.round(wrap(position)*12)/12),target=wrap(absolute-base),d=distance(position,absolute);if(!best||d<best.d-1e-12)best={c:target,ratio:null,d};}
 if(best&&best.d<.009){c=best.c;ratio=best.ratio;}
 if(ratio===null){const exact=ratios.find(k=>distance(c,Math.log2(k))<.00000051);if(exact!==undefined){ratio=exact;c=wrap(Math.log2(exact));}}
 return {c,ratio};
}
