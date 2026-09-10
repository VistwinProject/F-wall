// Coordinates follow the reference appliance photographs, not a generic icon grid.
// Photographs and these viewBoxes share the same aspect ratio and placement.
export function mappingDrawings({route,fan,coil,drop}){
 return {
 hrv:{w:100,h:56,body:`${fan(18,27,11)}${route('M18 27H39Q44 27 49 32L72 44H95','cool',3)}${route('M95 12H72L48 39H34','warm',3)}<path class="op-fin" d="M50 24l19 16m-15-20 19 16m-15-20 19 16"/>`},
 ac:{w:100,h:40.5,body:`${coil(10,6,80,13,'cool')}<path class="op-outlet-slot" d="M9 28H91M10 32H90"/>${[20,40,60,80].map(x=>route(`M${x} 29v4q-1 3-4 5`,'cool',2)).join('')}`},
 dehum:{w:100,h:183,body:`${route('M15 48H31Q38 48 38 38V20','neutral',3)}${route('M72 38V17H87','clean',2.5)}<path class="op-outlet-slot" d="M10 8H90M12 12H88"/>${[38,50,62].map((x,i)=>drop(x,73,i)).join('')}<path class="op-drain" d="M27 99Q50 107 73 99M50 104V128"/><path class="op-water" d="M10 163Q23 160 36 163T62 163T89 163"/><path class="op-water" d="M48 140v12"/>`},
 purifier:{w:100,h:318,body:`${[204,230,256].map(y=>`${route(`M5 ${y}H24Q36 ${y} 43 ${y-14}`,'neutral',2.7)}${route(`M95 ${y}H76Q64 ${y} 57 ${y-14}`,'neutral',2.7)}`).join('')}<path class="op-filter-shell" d="M18 194V280M25 194V280M75 194V280M82 194V280"/>${fan(50,187,12)}${route('M38 178Q21 166 21 143V40Q21 14 50 14','clean',2)}${route('M62 178Q79 166 79 143V40Q79 14 50 14','clean',2)}${[49,83,117].map(y=>`${route(`M30 ${y}Q37 ${y} 42 ${y-7}`,'clean',1.4)}${route(`M70 ${y}Q63 ${y} 58 ${y-7}`,'clean',1.4)}`).join('')}<path class="op-outlet-slot" d="M31 142V42Q31 25 50 25Q69 25 69 42V142"/>`},
 sensor:{w:100,h:44,body:`<g class="op-sensor-receive">${route('M2 8Q12 8 22 20','signal',1.7)}${route('M2 35Q12 35 22 24','signal',1.7)}</g><g class="op-model-scan"><path class="op-sensor-beam-halo" d="M21 7V37"/><path class="op-sensor-beam" d="M21 7V37"/></g><g class="op-sensor-send">${route('M78 22H97','signal',1.2)}</g>`},
 light:{w:100,h:175,body:`<g class="op-lamp-power">${route('M50 166V127Q50 114 50 99','power',2)}</g><g class="op-lamp-rise"><path class="op-diffuser-glow" d="M50 2C19 2 1 25 1 51Q1 67 11 80H89Q99 67 99 51C99 25 81 2 50 2Z"/><ellipse class="op-lamp-aura" cx="50" cy="46" rx="29" ry="30"/></g>`},
 socket:{w:100,h:49,body:`${route('M2 7H98','power',3)}${route('M98 44H2','signal',3)}${[14,50,86].map(x=>`<path class="op-socket-feed" d="M${x} 7V13m0 9v8"/><path class="op-socket-feedback" d="M${x} 36v8"/><path class="op-socket-lit" d="M${x-4} 14v5m8-5v5M${x-4} 31v5m8-5v5"/>`).join('')}`},
 curtain:{w:100,h:103.5,body:Array.from({length:8},(_,i)=>`<rect class="op-blind-slat" x="8" y="${9+i*10.7}" width="84" height="8.5" rx=".6"/>`).join('')},
 bathfan:{w:100,h:91,body:`<path class="op-outlet-slot" d="M22 28H78M24 34H76"/>${fan(50,22,7)}${[32,50,68].map(x=>route(`M${x} 34V47Q${x} 53 ${x-3} 57`,'warm',2)).join('')}<path class="op-coil op-warm" d="M30 39H70"/>${route('M81 61V43Q81 34 86 28','neutral',2.8)}`},
 };
}
