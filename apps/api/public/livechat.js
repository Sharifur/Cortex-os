var vs=Object.defineProperty,ws=Object.defineProperties;var ks=Object.getOwnPropertyDescriptors;var _t=Object.getOwnPropertySymbols;var _s=Object.prototype.hasOwnProperty,Ss=Object.prototype.propertyIsEnumerable;var St=(C,I,O)=>I in C?vs(C,I,{enumerable:!0,configurable:!0,writable:!0,value:O}):C[I]=O,K=(C,I)=>{for(var O in I||(I={}))_s.call(I,O)&&St(C,O,I[O]);if(_t)for(var O of _t(I))Ss.call(I,O)&&St(C,O,I[O]);return C},X=(C,I)=>ws(C,ks(I));(function(){"use strict";async function C(n){try{const e=await fetch(`${n.apiBase}/livechat/config?siteKey=${encodeURIComponent(n.siteKey)}`,{method:"GET",credentials:"omit"});return e.ok?await e.json():null}catch(e){return null}}async function I(n,e,t){const s=new FormData;s.append("siteKey",n.siteKey),s.append("visitorId",n.visitorId),s.append("sessionId",e),s.append("file",t,t.name);const i=await fetch(`${n.apiBase}/livechat/upload`,{method:"POST",body:s,credentials:"omit"});if(!i.ok){const r=await i.text().catch(()=>"");throw new Error(`${i.status} ${i.statusText}${r?` — ${r}`:""}`)}return i.json()}async function O(n,e){const t=await fetch(n,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(e),credentials:"omit"});if(!t.ok){const s=await t.text().catch(()=>"");throw new Error(`${t.status} ${t.statusText}${s?` — ${s}`:""}`)}return t.json()}function Et(n,e){return O(`${n.apiBase}/livechat/track/pageview`,K({siteKey:n.siteKey,visitorId:n.visitorId},e))}function Tt(n,e){return O(`${n.apiBase}/livechat/track/heartbeat`,{siteKey:n.siteKey,visitorId:n.visitorId,url:e.url,title:e.title}).catch(()=>{})}function Pe(n,e){const t=`${n.apiBase}/livechat/track/leave`,s=JSON.stringify({siteKey:n.siteKey,visitorId:n.visitorId,pageviewId:e});if(navigator.sendBeacon){const i=new Blob([s],{type:"application/json"});navigator.sendBeacon(t,i);return}fetch(t,{method:"POST",headers:{"Content-Type":"application/json"},body:s,keepalive:!0}).catch(()=>{})}function At(n,e,t,s){return O(`${n.apiBase}/livechat/message`,{siteKey:n.siteKey,visitorId:n.visitorId,content:e,attachmentIds:t&&t.length?t:void 0,meta:s})}function It(n,e){return O(`${n.apiBase}/livechat/identify`,{siteKey:n.siteKey,visitorId:n.visitorId,email:e.email,name:e.name})}const M=Object.create(null);M.open="0",M.close="1",M.ping="2",M.pong="3",M.message="4",M.upgrade="5",M.noop="6";const ie=Object.create(null);Object.keys(M).forEach(n=>{ie[M[n]]=n});const ye={type:"error",data:"parser error"},je=typeof Blob=="function"||typeof Blob!="undefined"&&Object.prototype.toString.call(Blob)==="[object BlobConstructor]",De=typeof ArrayBuffer=="function",ze=n=>typeof ArrayBuffer.isView=="function"?ArrayBuffer.isView(n):n&&n.buffer instanceof ArrayBuffer,be=({type:n,data:e},t,s)=>je&&e instanceof Blob?t?s(e):Ue(e,s):De&&(e instanceof ArrayBuffer||ze(e))?t?s(e):Ue(new Blob([e]),s):s(M[n]+(e||"")),Ue=(n,e)=>{const t=new FileReader;return t.onload=function(){const s=t.result.split(",")[1];e("b"+(s||""))},t.readAsDataURL(n)};function He(n){return n instanceof Uint8Array?n:n instanceof ArrayBuffer?new Uint8Array(n):new Uint8Array(n.buffer,n.byteOffset,n.byteLength)}let xe;function Ot(n,e){if(je&&n.data instanceof Blob)return n.data.arrayBuffer().then(He).then(e);if(De&&(n.data instanceof ArrayBuffer||ze(n.data)))return e(He(n.data));be(n,!1,t=>{xe||(xe=new TextEncoder),e(xe.encode(t))})}const Fe="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",Q=typeof Uint8Array=="undefined"?[]:new Uint8Array(256);for(let n=0;n<Fe.length;n++)Q[Fe.charCodeAt(n)]=n;const Lt=n=>{let e=n.length*.75,t=n.length,s,i=0,r,o,l,c;n[n.length-1]==="="&&(e--,n[n.length-2]==="="&&e--);const b=new ArrayBuffer(e),f=new Uint8Array(b);for(s=0;s<t;s+=4)r=Q[n.charCodeAt(s)],o=Q[n.charCodeAt(s+1)],l=Q[n.charCodeAt(s+2)],c=Q[n.charCodeAt(s+3)],f[i++]=r<<2|o>>4,f[i++]=(o&15)<<4|l>>2,f[i++]=(l&3)<<6|c&63;return b},Bt=typeof ArrayBuffer=="function",ve=(n,e)=>{if(typeof n!="string")return{type:"message",data:Ve(n,e)};const t=n.charAt(0);return t==="b"?{type:"message",data:Rt(n.substring(1),e)}:ie[t]?n.length>1?{type:ie[t],data:n.substring(1)}:{type:ie[t]}:ye},Rt=(n,e)=>{if(Bt){const t=Lt(n);return Ve(t,e)}else return{base64:!0,data:n}},Ve=(n,e)=>{switch(e){case"blob":return n instanceof Blob?n:new Blob([n]);case"arraybuffer":default:return n instanceof ArrayBuffer?n:n.buffer}},Ke="",Ct=(n,e)=>{const t=n.length,s=new Array(t);let i=0;n.forEach((r,o)=>{be(r,!1,l=>{s[o]=l,++i===t&&e(s.join(Ke))})})},$t=(n,e)=>{const t=n.split(Ke),s=[];for(let i=0;i<t.length;i++){const r=ve(t[i],e);if(s.push(r),r.type==="error")break}return s};function Nt(){return new TransformStream({transform(n,e){Ot(n,t=>{const s=t.length;let i;if(s<126)i=new Uint8Array(1),new DataView(i.buffer).setUint8(0,s);else if(s<65536){i=new Uint8Array(3);const r=new DataView(i.buffer);r.setUint8(0,126),r.setUint16(1,s)}else{i=new Uint8Array(9);const r=new DataView(i.buffer);r.setUint8(0,127),r.setBigUint64(1,BigInt(s))}n.data&&typeof n.data!="string"&&(i[0]|=128),e.enqueue(i),e.enqueue(t)})}})}let we;function re(n){return n.reduce((e,t)=>e+t.length,0)}function oe(n,e){if(n[0].length===e)return n.shift();const t=new Uint8Array(e);let s=0;for(let i=0;i<e;i++)t[i]=n[0][s++],s===n[0].length&&(n.shift(),s=0);return n.length&&s<n[0].length&&(n[0]=n[0].slice(s)),t}function qt(n,e){we||(we=new TextDecoder);const t=[];let s=0,i=-1,r=!1;return new TransformStream({transform(o,l){for(t.push(o);;){if(s===0){if(re(t)<1)break;const c=oe(t,1);r=(c[0]&128)===128,i=c[0]&127,i<126?s=3:i===126?s=1:s=2}else if(s===1){if(re(t)<2)break;const c=oe(t,2);i=new DataView(c.buffer,c.byteOffset,c.length).getUint16(0),s=3}else if(s===2){if(re(t)<8)break;const c=oe(t,8),b=new DataView(c.buffer,c.byteOffset,c.length),f=b.getUint32(0);if(f>Math.pow(2,21)-1){l.enqueue(ye);break}i=f*Math.pow(2,32)+b.getUint32(4),s=3}else{if(re(t)<i)break;const c=oe(t,i);l.enqueue(ve(r?c:we.decode(c),e)),s=0}if(i===0||i>n){l.enqueue(ye);break}}}})}const Ye=4;function _(n){if(n)return Mt(n)}function Mt(n){for(var e in _.prototype)n[e]=_.prototype[e];return n}_.prototype.on=_.prototype.addEventListener=function(n,e){return this._callbacks=this._callbacks||{},(this._callbacks["$"+n]=this._callbacks["$"+n]||[]).push(e),this},_.prototype.once=function(n,e){function t(){this.off(n,t),e.apply(this,arguments)}return t.fn=e,this.on(n,t),this},_.prototype.off=_.prototype.removeListener=_.prototype.removeAllListeners=_.prototype.removeEventListener=function(n,e){if(this._callbacks=this._callbacks||{},arguments.length==0)return this._callbacks={},this;var t=this._callbacks["$"+n];if(!t)return this;if(arguments.length==1)return delete this._callbacks["$"+n],this;for(var s,i=0;i<t.length;i++)if(s=t[i],s===e||s.fn===e){t.splice(i,1);break}return t.length===0&&delete this._callbacks["$"+n],this},_.prototype.emit=function(n){this._callbacks=this._callbacks||{};for(var e=new Array(arguments.length-1),t=this._callbacks["$"+n],s=1;s<arguments.length;s++)e[s-1]=arguments[s];if(t){t=t.slice(0);for(var s=0,i=t.length;s<i;++s)t[s].apply(this,e)}return this},_.prototype.emitReserved=_.prototype.emit,_.prototype.listeners=function(n){return this._callbacks=this._callbacks||{},this._callbacks["$"+n]||[]},_.prototype.hasListeners=function(n){return!!this.listeners(n).length};const ae=typeof Promise=="function"&&typeof Promise.resolve=="function"?e=>Promise.resolve().then(e):(e,t)=>t(e,0),L=typeof self!="undefined"?self:typeof window!="undefined"?window:Function("return this")(),Pt="arraybuffer";function Es(){}function We(n,...e){return e.reduce((t,s)=>(n.hasOwnProperty(s)&&(t[s]=n[s]),t),{})}const jt=L.setTimeout,Dt=L.clearTimeout;function ce(n,e){e.useNativeTimers?(n.setTimeoutFn=jt.bind(L),n.clearTimeoutFn=Dt.bind(L)):(n.setTimeoutFn=L.setTimeout.bind(L),n.clearTimeoutFn=L.clearTimeout.bind(L))}const zt=1.33;function Ut(n){return typeof n=="string"?Ht(n):Math.ceil((n.byteLength||n.size)*zt)}function Ht(n){let e=0,t=0;for(let s=0,i=n.length;s<i;s++)e=n.charCodeAt(s),e<128?t+=1:e<2048?t+=2:e<55296||e>=57344?t+=3:(s++,t+=4);return t}function Je(){return Date.now().toString(36).substring(3)+Math.random().toString(36).substring(2,5)}function Ft(n){let e="";for(let t in n)n.hasOwnProperty(t)&&(e.length&&(e+="&"),e+=encodeURIComponent(t)+"="+encodeURIComponent(n[t]));return e}function Vt(n){let e={},t=n.split("&");for(let s=0,i=t.length;s<i;s++){let r=t[s].split("=");e[decodeURIComponent(r[0])]=decodeURIComponent(r[1])}return e}class Kt extends Error{constructor(e,t,s){super(e),this.description=t,this.context=s,this.type="TransportError"}}class ke extends _{constructor(e){super(),this.writable=!1,ce(this,e),this.opts=e,this.query=e.query,this.socket=e.socket,this.supportsBinary=!e.forceBase64}onError(e,t,s){return super.emitReserved("error",new Kt(e,t,s)),this}open(){return this.readyState="opening",this.doOpen(),this}close(){return(this.readyState==="opening"||this.readyState==="open")&&(this.doClose(),this.onClose()),this}send(e){this.readyState==="open"&&this.write(e)}onOpen(){this.readyState="open",this.writable=!0,super.emitReserved("open")}onData(e){const t=ve(e,this.socket.binaryType);this.onPacket(t)}onPacket(e){super.emitReserved("packet",e)}onClose(e){this.readyState="closed",super.emitReserved("close",e)}pause(e){}createUri(e,t={}){return e+"://"+this._hostname()+this._port()+this.opts.path+this._query(t)}_hostname(){const e=this.opts.hostname;return e.indexOf(":")===-1?e:"["+e+"]"}_port(){return this.opts.port&&(this.opts.secure&&Number(this.opts.port)!==443||!this.opts.secure&&Number(this.opts.port)!==80)?":"+this.opts.port:""}_query(e){const t=Ft(e);return t.length?"?"+t:""}}class Yt extends ke{constructor(){super(...arguments),this._polling=!1}get name(){return"polling"}doOpen(){this._poll()}pause(e){this.readyState="pausing";const t=()=>{this.readyState="paused",e()};if(this._polling||!this.writable){let s=0;this._polling&&(s++,this.once("pollComplete",function(){--s||t()})),this.writable||(s++,this.once("drain",function(){--s||t()}))}else t()}_poll(){this._polling=!0,this.doPoll(),this.emitReserved("poll")}onData(e){const t=s=>{if(this.readyState==="opening"&&s.type==="open"&&this.onOpen(),s.type==="close")return this.onClose({description:"transport closed by the server"}),!1;this.onPacket(s)};$t(e,this.socket.binaryType).forEach(t),this.readyState!=="closed"&&(this._polling=!1,this.emitReserved("pollComplete"),this.readyState==="open"&&this._poll())}doClose(){const e=()=>{this.write([{type:"close"}])};this.readyState==="open"?e():this.once("open",e)}write(e){this.writable=!1,Ct(e,t=>{this.doWrite(t,()=>{this.writable=!0,this.emitReserved("drain")})})}uri(){const e=this.opts.secure?"https":"http",t=this.query||{};return this.opts.timestampRequests!==!1&&(t[this.opts.timestampParam]=Je()),!this.supportsBinary&&!t.sid&&(t.b64=1),this.createUri(e,t)}}let Xe=!1;try{Xe=typeof XMLHttpRequest!="undefined"&&"withCredentials"in new XMLHttpRequest}catch(n){}const Wt=Xe;function Jt(){}class Xt extends Yt{constructor(e){if(super(e),typeof location!="undefined"){const t=location.protocol==="https:";let s=location.port;s||(s=t?"443":"80"),this.xd=typeof location!="undefined"&&e.hostname!==location.hostname||s!==e.port}}doWrite(e,t){const s=this.request({method:"POST",data:e});s.on("success",t),s.on("error",(i,r)=>{this.onError("xhr post error",i,r)})}doPoll(){const e=this.request();e.on("data",this.onData.bind(this)),e.on("error",(t,s)=>{this.onError("xhr poll error",t,s)}),this.pollXhr=e}}class P extends _{constructor(e,t,s){super(),this.createRequest=e,ce(this,s),this._opts=s,this._method=s.method||"GET",this._uri=t,this._data=s.data!==void 0?s.data:null,this._create()}_create(){var e;const t=We(this._opts,"agent","pfx","key","passphrase","cert","ca","ciphers","rejectUnauthorized","autoUnref");t.xdomain=!!this._opts.xd;const s=this._xhr=this.createRequest(t);try{s.open(this._method,this._uri,!0);try{if(this._opts.extraHeaders){s.setDisableHeaderCheck&&s.setDisableHeaderCheck(!0);for(let i in this._opts.extraHeaders)this._opts.extraHeaders.hasOwnProperty(i)&&s.setRequestHeader(i,this._opts.extraHeaders[i])}}catch(i){}if(this._method==="POST")try{s.setRequestHeader("Content-type","text/plain;charset=UTF-8")}catch(i){}try{s.setRequestHeader("Accept","*/*")}catch(i){}(e=this._opts.cookieJar)===null||e===void 0||e.addCookies(s),"withCredentials"in s&&(s.withCredentials=this._opts.withCredentials),this._opts.requestTimeout&&(s.timeout=this._opts.requestTimeout),s.onreadystatechange=()=>{var i;s.readyState===3&&((i=this._opts.cookieJar)===null||i===void 0||i.parseCookies(s.getResponseHeader("set-cookie"))),s.readyState===4&&(s.status===200||s.status===1223?this._onLoad():this.setTimeoutFn(()=>{this._onError(typeof s.status=="number"?s.status:0)},0))},s.send(this._data)}catch(i){this.setTimeoutFn(()=>{this._onError(i)},0);return}typeof document!="undefined"&&(this._index=P.requestsCount++,P.requests[this._index]=this)}_onError(e){this.emitReserved("error",e,this._xhr),this._cleanup(!0)}_cleanup(e){if(!(typeof this._xhr=="undefined"||this._xhr===null)){if(this._xhr.onreadystatechange=Jt,e)try{this._xhr.abort()}catch(t){}typeof document!="undefined"&&delete P.requests[this._index],this._xhr=null}}_onLoad(){const e=this._xhr.responseText;e!==null&&(this.emitReserved("data",e),this.emitReserved("success"),this._cleanup())}abort(){this._cleanup()}}if(P.requestsCount=0,P.requests={},typeof document!="undefined"){if(typeof attachEvent=="function")attachEvent("onunload",Qe);else if(typeof addEventListener=="function"){const n="onpagehide"in L?"pagehide":"unload";addEventListener(n,Qe,!1)}}function Qe(){for(let n in P.requests)P.requests.hasOwnProperty(n)&&P.requests[n].abort()}const Qt=(function(){const n=Ge({xdomain:!1});return n&&n.responseType!==null})();class Gt extends Xt{constructor(e){super(e);const t=e&&e.forceBase64;this.supportsBinary=Qt&&!t}request(e={}){return Object.assign(e,{xd:this.xd},this.opts),new P(Ge,this.uri(),e)}}function Ge(n){const e=n.xdomain;try{if(typeof XMLHttpRequest!="undefined"&&(!e||Wt))return new XMLHttpRequest}catch(t){}if(!e)try{return new L[["Active"].concat("Object").join("X")]("Microsoft.XMLHTTP")}catch(t){}}const Ze=typeof navigator!="undefined"&&typeof navigator.product=="string"&&navigator.product.toLowerCase()==="reactnative";class Zt extends ke{get name(){return"websocket"}doOpen(){const e=this.uri(),t=this.opts.protocols,s=Ze?{}:We(this.opts,"agent","perMessageDeflate","pfx","key","passphrase","cert","ca","ciphers","rejectUnauthorized","localAddress","protocolVersion","origin","maxPayload","family","checkServerIdentity");this.opts.extraHeaders&&(s.headers=this.opts.extraHeaders);try{this.ws=this.createSocket(e,t,s)}catch(i){return this.emitReserved("error",i)}this.ws.binaryType=this.socket.binaryType,this.addEventListeners()}addEventListeners(){this.ws.onopen=()=>{this.opts.autoUnref&&this.ws._socket.unref(),this.onOpen()},this.ws.onclose=e=>this.onClose({description:"websocket connection closed",context:e}),this.ws.onmessage=e=>this.onData(e.data),this.ws.onerror=e=>this.onError("websocket error",e)}write(e){this.writable=!1;for(let t=0;t<e.length;t++){const s=e[t],i=t===e.length-1;be(s,this.supportsBinary,r=>{try{this.doWrite(s,r)}catch(o){}i&&ae(()=>{this.writable=!0,this.emitReserved("drain")},this.setTimeoutFn)})}}doClose(){typeof this.ws!="undefined"&&(this.ws.onerror=()=>{},this.ws.close(),this.ws=null)}uri(){const e=this.opts.secure?"wss":"ws",t=this.query||{};return this.opts.timestampRequests&&(t[this.opts.timestampParam]=Je()),this.supportsBinary||(t.b64=1),this.createUri(e,t)}}const _e=L.WebSocket||L.MozWebSocket;class en extends Zt{createSocket(e,t,s){return Ze?new _e(e,t,s):t?new _e(e,t):new _e(e)}doWrite(e,t){this.ws.send(t)}}class tn extends ke{get name(){return"webtransport"}doOpen(){try{this._transport=new WebTransport(this.createUri("https"),this.opts.transportOptions[this.name])}catch(e){return this.emitReserved("error",e)}this._transport.closed.then(()=>{this.onClose()}).catch(e=>{this.onError("webtransport error",e)}),this._transport.ready.then(()=>{this._transport.createBidirectionalStream().then(e=>{const t=qt(Number.MAX_SAFE_INTEGER,this.socket.binaryType),s=e.readable.pipeThrough(t).getReader(),i=Nt();i.readable.pipeTo(e.writable),this._writer=i.writable.getWriter();const r=()=>{s.read().then(({done:l,value:c})=>{l||(this.onPacket(c),r())}).catch(l=>{})};r();const o={type:"open"};this.query.sid&&(o.data=`{"sid":"${this.query.sid}"}`),this._writer.write(o).then(()=>this.onOpen())})})}write(e){this.writable=!1;for(let t=0;t<e.length;t++){const s=e[t],i=t===e.length-1;this._writer.write(s).then(()=>{i&&ae(()=>{this.writable=!0,this.emitReserved("drain")},this.setTimeoutFn)})}}doClose(){var e;(e=this._transport)===null||e===void 0||e.close()}}const nn={websocket:en,webtransport:tn,polling:Gt},sn=/^(?:(?![^:@\/?#]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@\/?#]*)(?::([^:@\/?#]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/,rn=["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"];function Se(n){if(n.length>8e3)throw"URI too long";const e=n,t=n.indexOf("["),s=n.indexOf("]");t!=-1&&s!=-1&&(n=n.substring(0,t)+n.substring(t,s).replace(/:/g,";")+n.substring(s,n.length));let i=sn.exec(n||""),r={},o=14;for(;o--;)r[rn[o]]=i[o]||"";return t!=-1&&s!=-1&&(r.source=e,r.host=r.host.substring(1,r.host.length-1).replace(/;/g,":"),r.authority=r.authority.replace("[","").replace("]","").replace(/;/g,":"),r.ipv6uri=!0),r.pathNames=on(r,r.path),r.queryKey=an(r,r.query),r}function on(n,e){const t=/\/{2,9}/g,s=e.replace(t,"/").split("/");return(e.slice(0,1)=="/"||e.length===0)&&s.splice(0,1),e.slice(-1)=="/"&&s.splice(s.length-1,1),s}function an(n,e){const t={};return e.replace(/(?:^|&)([^&=]*)=?([^&]*)/g,function(s,i,r){i&&(t[i]=r)}),t}const Ee=typeof addEventListener=="function"&&typeof removeEventListener=="function",le=[];Ee&&addEventListener("offline",()=>{le.forEach(n=>n())},!1);class z extends _{constructor(e,t){if(super(),this.binaryType=Pt,this.writeBuffer=[],this._prevBufferLen=0,this._pingInterval=-1,this._pingTimeout=-1,this._maxPayload=-1,this._pingTimeoutTime=1/0,e&&typeof e=="object"&&(t=e,e=null),e){const s=Se(e);t.hostname=s.host,t.secure=s.protocol==="https"||s.protocol==="wss",t.port=s.port,s.query&&(t.query=s.query)}else t.host&&(t.hostname=Se(t.host).host);ce(this,t),this.secure=t.secure!=null?t.secure:typeof location!="undefined"&&location.protocol==="https:",t.hostname&&!t.port&&(t.port=this.secure?"443":"80"),this.hostname=t.hostname||(typeof location!="undefined"?location.hostname:"localhost"),this.port=t.port||(typeof location!="undefined"&&location.port?location.port:this.secure?"443":"80"),this.transports=[],this._transportsByName={},t.transports.forEach(s=>{const i=s.prototype.name;this.transports.push(i),this._transportsByName[i]=s}),this.opts=Object.assign({path:"/engine.io",agent:!1,withCredentials:!1,upgrade:!0,timestampParam:"t",rememberUpgrade:!1,addTrailingSlash:!0,rejectUnauthorized:!0,perMessageDeflate:{threshold:1024},transportOptions:{},closeOnBeforeunload:!1},t),this.opts.path=this.opts.path.replace(/\/$/,"")+(this.opts.addTrailingSlash?"/":""),typeof this.opts.query=="string"&&(this.opts.query=Vt(this.opts.query)),Ee&&(this.opts.closeOnBeforeunload&&(this._beforeunloadEventListener=()=>{this.transport&&(this.transport.removeAllListeners(),this.transport.close())},addEventListener("beforeunload",this._beforeunloadEventListener,!1)),this.hostname!=="localhost"&&(this._offlineEventListener=()=>{this._onClose("transport close",{description:"network connection lost"})},le.push(this._offlineEventListener))),this.opts.withCredentials&&(this._cookieJar=void 0),this._open()}createTransport(e){const t=Object.assign({},this.opts.query);t.EIO=Ye,t.transport=e,this.id&&(t.sid=this.id);const s=Object.assign({},this.opts,{query:t,socket:this,hostname:this.hostname,secure:this.secure,port:this.port},this.opts.transportOptions[e]);return new this._transportsByName[e](s)}_open(){if(this.transports.length===0){this.setTimeoutFn(()=>{this.emitReserved("error","No transports available")},0);return}const e=this.opts.rememberUpgrade&&z.priorWebsocketSuccess&&this.transports.indexOf("websocket")!==-1?"websocket":this.transports[0];this.readyState="opening";const t=this.createTransport(e);t.open(),this.setTransport(t)}setTransport(e){this.transport&&this.transport.removeAllListeners(),this.transport=e,e.on("drain",this._onDrain.bind(this)).on("packet",this._onPacket.bind(this)).on("error",this._onError.bind(this)).on("close",t=>this._onClose("transport close",t))}onOpen(){this.readyState="open",z.priorWebsocketSuccess=this.transport.name==="websocket",this.emitReserved("open"),this.flush()}_onPacket(e){if(this.readyState==="opening"||this.readyState==="open"||this.readyState==="closing")switch(this.emitReserved("packet",e),this.emitReserved("heartbeat"),e.type){case"open":this.onHandshake(JSON.parse(e.data));break;case"ping":this._sendPacket("pong"),this.emitReserved("ping"),this.emitReserved("pong"),this._resetPingTimeout();break;case"error":const t=new Error("server error");t.code=e.data,this._onError(t);break;case"message":this.emitReserved("data",e.data),this.emitReserved("message",e.data);break}}onHandshake(e){this.emitReserved("handshake",e),this.id=e.sid,this.transport.query.sid=e.sid,this._pingInterval=e.pingInterval,this._pingTimeout=e.pingTimeout,this._maxPayload=e.maxPayload,this.onOpen(),this.readyState!=="closed"&&this._resetPingTimeout()}_resetPingTimeout(){this.clearTimeoutFn(this._pingTimeoutTimer);const e=this._pingInterval+this._pingTimeout;this._pingTimeoutTime=Date.now()+e,this._pingTimeoutTimer=this.setTimeoutFn(()=>{this._onClose("ping timeout")},e),this.opts.autoUnref&&this._pingTimeoutTimer.unref()}_onDrain(){this.writeBuffer.splice(0,this._prevBufferLen),this._prevBufferLen=0,this.writeBuffer.length===0?this.emitReserved("drain"):this.flush()}flush(){if(this.readyState!=="closed"&&this.transport.writable&&!this.upgrading&&this.writeBuffer.length){const e=this._getWritablePackets();this.transport.send(e),this._prevBufferLen=e.length,this.emitReserved("flush")}}_getWritablePackets(){if(!(this._maxPayload&&this.transport.name==="polling"&&this.writeBuffer.length>1))return this.writeBuffer;let t=1;for(let s=0;s<this.writeBuffer.length;s++){const i=this.writeBuffer[s].data;if(i&&(t+=Ut(i)),s>0&&t>this._maxPayload)return this.writeBuffer.slice(0,s);t+=2}return this.writeBuffer}_hasPingExpired(){if(!this._pingTimeoutTime)return!0;const e=Date.now()>this._pingTimeoutTime;return e&&(this._pingTimeoutTime=0,ae(()=>{this._onClose("ping timeout")},this.setTimeoutFn)),e}write(e,t,s){return this._sendPacket("message",e,t,s),this}send(e,t,s){return this._sendPacket("message",e,t,s),this}_sendPacket(e,t,s,i){if(typeof t=="function"&&(i=t,t=void 0),typeof s=="function"&&(i=s,s=null),this.readyState==="closing"||this.readyState==="closed")return;s=s||{},s.compress=s.compress!==!1;const r={type:e,data:t,options:s};this.emitReserved("packetCreate",r),this.writeBuffer.push(r),i&&this.once("flush",i),this.flush()}close(){const e=()=>{this._onClose("forced close"),this.transport.close()},t=()=>{this.off("upgrade",t),this.off("upgradeError",t),e()},s=()=>{this.once("upgrade",t),this.once("upgradeError",t)};return(this.readyState==="opening"||this.readyState==="open")&&(this.readyState="closing",this.writeBuffer.length?this.once("drain",()=>{this.upgrading?s():e()}):this.upgrading?s():e()),this}_onError(e){if(z.priorWebsocketSuccess=!1,this.opts.tryAllTransports&&this.transports.length>1&&this.readyState==="opening")return this.transports.shift(),this._open();this.emitReserved("error",e),this._onClose("transport error",e)}_onClose(e,t){if(this.readyState==="opening"||this.readyState==="open"||this.readyState==="closing"){if(this.clearTimeoutFn(this._pingTimeoutTimer),this.transport.removeAllListeners("close"),this.transport.close(),this.transport.removeAllListeners(),Ee&&(this._beforeunloadEventListener&&removeEventListener("beforeunload",this._beforeunloadEventListener,!1),this._offlineEventListener)){const s=le.indexOf(this._offlineEventListener);s!==-1&&le.splice(s,1)}this.readyState="closed",this.id=null,this.emitReserved("close",e,t),this.writeBuffer=[],this._prevBufferLen=0}}}z.protocol=Ye;class cn extends z{constructor(){super(...arguments),this._upgrades=[]}onOpen(){if(super.onOpen(),this.readyState==="open"&&this.opts.upgrade)for(let e=0;e<this._upgrades.length;e++)this._probe(this._upgrades[e])}_probe(e){let t=this.createTransport(e),s=!1;z.priorWebsocketSuccess=!1;const i=()=>{s||(t.send([{type:"ping",data:"probe"}]),t.once("packet",x=>{if(!s)if(x.type==="pong"&&x.data==="probe"){if(this.upgrading=!0,this.emitReserved("upgrading",t),!t)return;z.priorWebsocketSuccess=t.name==="websocket",this.transport.pause(()=>{s||this.readyState!=="closed"&&(f(),this.setTransport(t),t.send([{type:"upgrade"}]),this.emitReserved("upgrade",t),t=null,this.upgrading=!1,this.flush())})}else{const m=new Error("probe error");m.transport=t.name,this.emitReserved("upgradeError",m)}}))};function r(){s||(s=!0,f(),t.close(),t=null)}const o=x=>{const m=new Error("probe error: "+x);m.transport=t.name,r(),this.emitReserved("upgradeError",m)};function l(){o("transport closed")}function c(){o("socket closed")}function b(x){t&&x.name!==t.name&&r()}const f=()=>{t.removeListener("open",i),t.removeListener("error",o),t.removeListener("close",l),this.off("close",c),this.off("upgrading",b)};t.once("open",i),t.once("error",o),t.once("close",l),this.once("close",c),this.once("upgrading",b),this._upgrades.indexOf("webtransport")!==-1&&e!=="webtransport"?this.setTimeoutFn(()=>{s||t.open()},200):t.open()}onHandshake(e){this._upgrades=this._filterUpgrades(e.upgrades),super.onHandshake(e)}_filterUpgrades(e){const t=[];for(let s=0;s<e.length;s++)~this.transports.indexOf(e[s])&&t.push(e[s]);return t}}let ln=class extends cn{constructor(e,t={}){const s=typeof e=="object"?e:t;(!s.transports||s.transports&&typeof s.transports[0]=="string")&&(s.transports=(s.transports||["polling","websocket","webtransport"]).map(i=>nn[i]).filter(i=>!!i)),super(e,s)}};function dn(n,e="",t){let s=n;t=t||typeof location!="undefined"&&location,n==null&&(n=t.protocol+"//"+t.host),typeof n=="string"&&(n.charAt(0)==="/"&&(n.charAt(1)==="/"?n=t.protocol+n:n=t.host+n),/^(https?|wss?):\/\//.test(n)||(typeof t!="undefined"?n=t.protocol+"//"+n:n="https://"+n),s=Se(n)),s.port||(/^(http|ws)$/.test(s.protocol)?s.port="80":/^(http|ws)s$/.test(s.protocol)&&(s.port="443")),s.path=s.path||"/";const r=s.host.indexOf(":")!==-1?"["+s.host+"]":s.host;return s.id=s.protocol+"://"+r+":"+s.port+e,s.href=s.protocol+"://"+r+(t&&t.port===s.port?"":":"+s.port),s}const hn=typeof ArrayBuffer=="function",pn=n=>typeof ArrayBuffer.isView=="function"?ArrayBuffer.isView(n):n.buffer instanceof ArrayBuffer,et=Object.prototype.toString,un=typeof Blob=="function"||typeof Blob!="undefined"&&et.call(Blob)==="[object BlobConstructor]",fn=typeof File=="function"||typeof File!="undefined"&&et.call(File)==="[object FileConstructor]";function Te(n){return hn&&(n instanceof ArrayBuffer||pn(n))||un&&n instanceof Blob||fn&&n instanceof File}function de(n,e){if(!n||typeof n!="object")return!1;if(Array.isArray(n)){for(let t=0,s=n.length;t<s;t++)if(de(n[t]))return!0;return!1}if(Te(n))return!0;if(n.toJSON&&typeof n.toJSON=="function"&&arguments.length===1)return de(n.toJSON(),!0);for(const t in n)if(Object.prototype.hasOwnProperty.call(n,t)&&de(n[t]))return!0;return!1}function gn(n){const e=[],t=n.data,s=n;return s.data=Ae(t,e),s.attachments=e.length,{packet:s,buffers:e}}function Ae(n,e){if(!n)return n;if(Te(n)){const t={_placeholder:!0,num:e.length};return e.push(n),t}else if(Array.isArray(n)){const t=new Array(n.length);for(let s=0;s<n.length;s++)t[s]=Ae(n[s],e);return t}else if(typeof n=="object"&&!(n instanceof Date)){const t={};for(const s in n)Object.prototype.hasOwnProperty.call(n,s)&&(t[s]=Ae(n[s],e));return t}return n}function mn(n,e){return n.data=Ie(n.data,e),delete n.attachments,n}function Ie(n,e){if(!n)return n;if(n&&n._placeholder===!0){if(typeof n.num=="number"&&n.num>=0&&n.num<e.length)return e[n.num];throw new Error("illegal attachments")}else if(Array.isArray(n))for(let t=0;t<n.length;t++)n[t]=Ie(n[t],e);else if(typeof n=="object")for(const t in n)Object.prototype.hasOwnProperty.call(n,t)&&(n[t]=Ie(n[t],e));return n}const yn=["connect","connect_error","disconnect","disconnecting","newListener","removeListener"];var g;(function(n){n[n.CONNECT=0]="CONNECT",n[n.DISCONNECT=1]="DISCONNECT",n[n.EVENT=2]="EVENT",n[n.ACK=3]="ACK",n[n.CONNECT_ERROR=4]="CONNECT_ERROR",n[n.BINARY_EVENT=5]="BINARY_EVENT",n[n.BINARY_ACK=6]="BINARY_ACK"})(g||(g={}));class bn{constructor(e){this.replacer=e}encode(e){return(e.type===g.EVENT||e.type===g.ACK)&&de(e)?this.encodeAsBinary({type:e.type===g.EVENT?g.BINARY_EVENT:g.BINARY_ACK,nsp:e.nsp,data:e.data,id:e.id}):[this.encodeAsString(e)]}encodeAsString(e){let t=""+e.type;return(e.type===g.BINARY_EVENT||e.type===g.BINARY_ACK)&&(t+=e.attachments+"-"),e.nsp&&e.nsp!=="/"&&(t+=e.nsp+","),e.id!=null&&(t+=e.id),e.data!=null&&(t+=JSON.stringify(e.data,this.replacer)),t}encodeAsBinary(e){const t=gn(e),s=this.encodeAsString(t.packet),i=t.buffers;return i.unshift(s),i}}class Oe extends _{constructor(e){super(),this.opts=Object.assign({reviver:void 0,maxAttachments:10},typeof e=="function"?{reviver:e}:e)}add(e){let t;if(typeof e=="string"){if(this.reconstructor)throw new Error("got plaintext data when reconstructing a packet");t=this.decodeString(e);const s=t.type===g.BINARY_EVENT;s||t.type===g.BINARY_ACK?(t.type=s?g.EVENT:g.ACK,this.reconstructor=new xn(t),t.attachments===0&&super.emitReserved("decoded",t)):super.emitReserved("decoded",t)}else if(Te(e)||e.base64)if(this.reconstructor)t=this.reconstructor.takeBinaryData(e),t&&(this.reconstructor=null,super.emitReserved("decoded",t));else throw new Error("got binary data when not reconstructing a packet");else throw new Error("Unknown type: "+e)}decodeString(e){let t=0;const s={type:Number(e.charAt(0))};if(g[s.type]===void 0)throw new Error("unknown packet type "+s.type);if(s.type===g.BINARY_EVENT||s.type===g.BINARY_ACK){const r=t+1;for(;e.charAt(++t)!=="-"&&t!=e.length;);const o=e.substring(r,t);if(o!=Number(o)||e.charAt(t)!=="-")throw new Error("Illegal attachments");const l=Number(o);if(!vn(l)||l<0)throw new Error("Illegal attachments");if(l>this.opts.maxAttachments)throw new Error("too many attachments");s.attachments=l}if(e.charAt(t+1)==="/"){const r=t+1;for(;++t&&!(e.charAt(t)===","||t===e.length););s.nsp=e.substring(r,t)}else s.nsp="/";const i=e.charAt(t+1);if(i!==""&&Number(i)==i){const r=t+1;for(;++t;){const o=e.charAt(t);if(o==null||Number(o)!=o){--t;break}if(t===e.length)break}s.id=Number(e.substring(r,t+1))}if(e.charAt(++t)){const r=this.tryParse(e.substr(t));if(Oe.isPayloadValid(s.type,r))s.data=r;else throw new Error("invalid payload")}return s}tryParse(e){try{return JSON.parse(e,this.opts.reviver)}catch(t){return!1}}static isPayloadValid(e,t){switch(e){case g.CONNECT:return tt(t);case g.DISCONNECT:return t===void 0;case g.CONNECT_ERROR:return typeof t=="string"||tt(t);case g.EVENT:case g.BINARY_EVENT:return Array.isArray(t)&&(typeof t[0]=="number"||typeof t[0]=="string"&&yn.indexOf(t[0])===-1);case g.ACK:case g.BINARY_ACK:return Array.isArray(t)}}destroy(){this.reconstructor&&(this.reconstructor.finishedReconstruction(),this.reconstructor=null)}}class xn{constructor(e){this.packet=e,this.buffers=[],this.reconPack=e}takeBinaryData(e){if(this.buffers.push(e),this.buffers.length===this.reconPack.attachments){const t=mn(this.reconPack,this.buffers);return this.finishedReconstruction(),t}return null}finishedReconstruction(){this.reconPack=null,this.buffers=[]}}const vn=Number.isInteger||function(n){return typeof n=="number"&&isFinite(n)&&Math.floor(n)===n};function tt(n){return Object.prototype.toString.call(n)==="[object Object]"}const wn=Object.freeze(Object.defineProperty({__proto__:null,Decoder:Oe,Encoder:bn,get PacketType(){return g}},Symbol.toStringTag,{value:"Module"}));function $(n,e,t){return n.on(e,t),function(){n.off(e,t)}}const kn=Object.freeze({connect:1,connect_error:1,disconnect:1,disconnecting:1,newListener:1,removeListener:1});class nt extends _{constructor(e,t,s){super(),this.connected=!1,this.recovered=!1,this.receiveBuffer=[],this.sendBuffer=[],this._queue=[],this._queueSeq=0,this.ids=0,this.acks={},this.flags={},this.io=e,this.nsp=t,s&&s.auth&&(this.auth=s.auth),this._opts=Object.assign({},s),this.io._autoConnect&&this.open()}get disconnected(){return!this.connected}subEvents(){if(this.subs)return;const e=this.io;this.subs=[$(e,"open",this.onopen.bind(this)),$(e,"packet",this.onpacket.bind(this)),$(e,"error",this.onerror.bind(this)),$(e,"close",this.onclose.bind(this))]}get active(){return!!this.subs}connect(){return this.connected?this:(this.subEvents(),this.io._reconnecting||this.io.open(),this.io._readyState==="open"&&this.onopen(),this)}open(){return this.connect()}send(...e){return e.unshift("message"),this.emit.apply(this,e),this}emit(e,...t){var s,i,r;if(kn.hasOwnProperty(e))throw new Error('"'+e.toString()+'" is a reserved event name');if(t.unshift(e),this._opts.retries&&!this.flags.fromQueue&&!this.flags.volatile)return this._addToQueue(t),this;const o={type:g.EVENT,data:t};if(o.options={},o.options.compress=this.flags.compress!==!1,typeof t[t.length-1]=="function"){const f=this.ids++,x=t.pop();this._registerAckCallback(f,x),o.id=f}const l=(i=(s=this.io.engine)===null||s===void 0?void 0:s.transport)===null||i===void 0?void 0:i.writable,c=this.connected&&!(!((r=this.io.engine)===null||r===void 0)&&r._hasPingExpired());return this.flags.volatile&&!l||(c?(this.notifyOutgoingListeners(o),this.packet(o)):this.sendBuffer.push(o)),this.flags={},this}_registerAckCallback(e,t){var s;const i=(s=this.flags.timeout)!==null&&s!==void 0?s:this._opts.ackTimeout;if(i===void 0){this.acks[e]=t;return}const r=this.io.setTimeoutFn(()=>{delete this.acks[e];for(let l=0;l<this.sendBuffer.length;l++)this.sendBuffer[l].id===e&&this.sendBuffer.splice(l,1);t.call(this,new Error("operation has timed out"))},i),o=(...l)=>{this.io.clearTimeoutFn(r),t.apply(this,l)};o.withError=!0,this.acks[e]=o}emitWithAck(e,...t){return new Promise((s,i)=>{const r=(o,l)=>o?i(o):s(l);r.withError=!0,t.push(r),this.emit(e,...t)})}_addToQueue(e){let t;typeof e[e.length-1]=="function"&&(t=e.pop());const s={id:this._queueSeq++,tryCount:0,pending:!1,args:e,flags:Object.assign({fromQueue:!0},this.flags)};e.push((i,...r)=>(this._queue[0],i!==null?s.tryCount>this._opts.retries&&(this._queue.shift(),t&&t(i)):(this._queue.shift(),t&&t(null,...r)),s.pending=!1,this._drainQueue())),this._queue.push(s),this._drainQueue()}_drainQueue(e=!1){if(!this.connected||this._queue.length===0)return;const t=this._queue[0];t.pending&&!e||(t.pending=!0,t.tryCount++,this.flags=t.flags,this.emit.apply(this,t.args))}packet(e){e.nsp=this.nsp,this.io._packet(e)}onopen(){typeof this.auth=="function"?this.auth(e=>{this._sendConnectPacket(e)}):this._sendConnectPacket(this.auth)}_sendConnectPacket(e){this.packet({type:g.CONNECT,data:this._pid?Object.assign({pid:this._pid,offset:this._lastOffset},e):e})}onerror(e){this.connected||this.emitReserved("connect_error",e)}onclose(e,t){this.connected=!1,delete this.id,this.emitReserved("disconnect",e,t),this._clearAcks()}_clearAcks(){Object.keys(this.acks).forEach(e=>{if(!this.sendBuffer.some(s=>String(s.id)===e)){const s=this.acks[e];delete this.acks[e],s.withError&&s.call(this,new Error("socket has been disconnected"))}})}onpacket(e){if(e.nsp===this.nsp)switch(e.type){case g.CONNECT:e.data&&e.data.sid?this.onconnect(e.data.sid,e.data.pid):this.emitReserved("connect_error",new Error("It seems you are trying to reach a Socket.IO server in v2.x with a v3.x client, but they are not compatible (more information here: https://socket.io/docs/v3/migrating-from-2-x-to-3-0/)"));break;case g.EVENT:case g.BINARY_EVENT:this.onevent(e);break;case g.ACK:case g.BINARY_ACK:this.onack(e);break;case g.DISCONNECT:this.ondisconnect();break;case g.CONNECT_ERROR:this.destroy();const s=new Error(e.data.message);s.data=e.data.data,this.emitReserved("connect_error",s);break}}onevent(e){const t=e.data||[];e.id!=null&&t.push(this.ack(e.id)),this.connected?this.emitEvent(t):this.receiveBuffer.push(Object.freeze(t))}emitEvent(e){if(this._anyListeners&&this._anyListeners.length){const t=this._anyListeners.slice();for(const s of t)s.apply(this,e)}super.emit.apply(this,e),this._pid&&e.length&&typeof e[e.length-1]=="string"&&(this._lastOffset=e[e.length-1])}ack(e){const t=this;let s=!1;return function(...i){s||(s=!0,t.packet({type:g.ACK,id:e,data:i}))}}onack(e){const t=this.acks[e.id];typeof t=="function"&&(delete this.acks[e.id],t.withError&&e.data.unshift(null),t.apply(this,e.data))}onconnect(e,t){this.id=e,this.recovered=t&&this._pid===t,this._pid=t,this.connected=!0,this.emitBuffered(),this._drainQueue(!0),this.emitReserved("connect")}emitBuffered(){this.receiveBuffer.forEach(e=>this.emitEvent(e)),this.receiveBuffer=[],this.sendBuffer.forEach(e=>{this.notifyOutgoingListeners(e),this.packet(e)}),this.sendBuffer=[]}ondisconnect(){this.destroy(),this.onclose("io server disconnect")}destroy(){this.subs&&(this.subs.forEach(e=>e()),this.subs=void 0),this.io._destroy(this)}disconnect(){return this.connected&&this.packet({type:g.DISCONNECT}),this.destroy(),this.connected&&this.onclose("io client disconnect"),this}close(){return this.disconnect()}compress(e){return this.flags.compress=e,this}get volatile(){return this.flags.volatile=!0,this}timeout(e){return this.flags.timeout=e,this}onAny(e){return this._anyListeners=this._anyListeners||[],this._anyListeners.push(e),this}prependAny(e){return this._anyListeners=this._anyListeners||[],this._anyListeners.unshift(e),this}offAny(e){if(!this._anyListeners)return this;if(e){const t=this._anyListeners;for(let s=0;s<t.length;s++)if(e===t[s])return t.splice(s,1),this}else this._anyListeners=[];return this}listenersAny(){return this._anyListeners||[]}onAnyOutgoing(e){return this._anyOutgoingListeners=this._anyOutgoingListeners||[],this._anyOutgoingListeners.push(e),this}prependAnyOutgoing(e){return this._anyOutgoingListeners=this._anyOutgoingListeners||[],this._anyOutgoingListeners.unshift(e),this}offAnyOutgoing(e){if(!this._anyOutgoingListeners)return this;if(e){const t=this._anyOutgoingListeners;for(let s=0;s<t.length;s++)if(e===t[s])return t.splice(s,1),this}else this._anyOutgoingListeners=[];return this}listenersAnyOutgoing(){return this._anyOutgoingListeners||[]}notifyOutgoingListeners(e){if(this._anyOutgoingListeners&&this._anyOutgoingListeners.length){const t=this._anyOutgoingListeners.slice();for(const s of t)s.apply(this,e.data)}}}function Y(n){n=n||{},this.ms=n.min||100,this.max=n.max||1e4,this.factor=n.factor||2,this.jitter=n.jitter>0&&n.jitter<=1?n.jitter:0,this.attempts=0}Y.prototype.duration=function(){var n=this.ms*Math.pow(this.factor,this.attempts++);if(this.jitter){var e=Math.random(),t=Math.floor(e*this.jitter*n);n=(Math.floor(e*10)&1)==0?n-t:n+t}return Math.min(n,this.max)|0},Y.prototype.reset=function(){this.attempts=0},Y.prototype.setMin=function(n){this.ms=n},Y.prototype.setMax=function(n){this.max=n},Y.prototype.setJitter=function(n){this.jitter=n};class Le extends _{constructor(e,t){var s;super(),this.nsps={},this.subs=[],e&&typeof e=="object"&&(t=e,e=void 0),t=t||{},t.path=t.path||"/socket.io",this.opts=t,ce(this,t),this.reconnection(t.reconnection!==!1),this.reconnectionAttempts(t.reconnectionAttempts||1/0),this.reconnectionDelay(t.reconnectionDelay||1e3),this.reconnectionDelayMax(t.reconnectionDelayMax||5e3),this.randomizationFactor((s=t.randomizationFactor)!==null&&s!==void 0?s:.5),this.backoff=new Y({min:this.reconnectionDelay(),max:this.reconnectionDelayMax(),jitter:this.randomizationFactor()}),this.timeout(t.timeout==null?2e4:t.timeout),this._readyState="closed",this.uri=e;const i=t.parser||wn;this.encoder=new i.Encoder,this.decoder=new i.Decoder,this._autoConnect=t.autoConnect!==!1,this._autoConnect&&this.open()}reconnection(e){return arguments.length?(this._reconnection=!!e,e||(this.skipReconnect=!0),this):this._reconnection}reconnectionAttempts(e){return e===void 0?this._reconnectionAttempts:(this._reconnectionAttempts=e,this)}reconnectionDelay(e){var t;return e===void 0?this._reconnectionDelay:(this._reconnectionDelay=e,(t=this.backoff)===null||t===void 0||t.setMin(e),this)}randomizationFactor(e){var t;return e===void 0?this._randomizationFactor:(this._randomizationFactor=e,(t=this.backoff)===null||t===void 0||t.setJitter(e),this)}reconnectionDelayMax(e){var t;return e===void 0?this._reconnectionDelayMax:(this._reconnectionDelayMax=e,(t=this.backoff)===null||t===void 0||t.setMax(e),this)}timeout(e){return arguments.length?(this._timeout=e,this):this._timeout}maybeReconnectOnOpen(){!this._reconnecting&&this._reconnection&&this.backoff.attempts===0&&this.reconnect()}open(e){if(~this._readyState.indexOf("open"))return this;this.engine=new ln(this.uri,this.opts);const t=this.engine,s=this;this._readyState="opening",this.skipReconnect=!1;const i=$(t,"open",function(){s.onopen(),e&&e()}),r=l=>{this.cleanup(),this._readyState="closed",this.emitReserved("error",l),e?e(l):this.maybeReconnectOnOpen()},o=$(t,"error",r);if(this._timeout!==!1){const l=this._timeout,c=this.setTimeoutFn(()=>{i(),r(new Error("timeout")),t.close()},l);this.opts.autoUnref&&c.unref(),this.subs.push(()=>{this.clearTimeoutFn(c)})}return this.subs.push(i),this.subs.push(o),this}connect(e){return this.open(e)}onopen(){this.cleanup(),this._readyState="open",this.emitReserved("open");const e=this.engine;this.subs.push($(e,"ping",this.onping.bind(this)),$(e,"data",this.ondata.bind(this)),$(e,"error",this.onerror.bind(this)),$(e,"close",this.onclose.bind(this)),$(this.decoder,"decoded",this.ondecoded.bind(this)))}onping(){this.emitReserved("ping")}ondata(e){try{this.decoder.add(e)}catch(t){this.onclose("parse error",t)}}ondecoded(e){ae(()=>{this.emitReserved("packet",e)},this.setTimeoutFn)}onerror(e){this.emitReserved("error",e)}socket(e,t){let s=this.nsps[e];return s?this._autoConnect&&!s.active&&s.connect():(s=new nt(this,e,t),this.nsps[e]=s),s}_destroy(e){const t=Object.keys(this.nsps);for(const s of t)if(this.nsps[s].active)return;this._close()}_packet(e){const t=this.encoder.encode(e);for(let s=0;s<t.length;s++)this.engine.write(t[s],e.options)}cleanup(){this.subs.forEach(e=>e()),this.subs.length=0,this.decoder.destroy()}_close(){this.skipReconnect=!0,this._reconnecting=!1,this.onclose("forced close")}disconnect(){return this._close()}onclose(e,t){var s;this.cleanup(),(s=this.engine)===null||s===void 0||s.close(),this.backoff.reset(),this._readyState="closed",this.emitReserved("close",e,t),this._reconnection&&!this.skipReconnect&&this.reconnect()}reconnect(){if(this._reconnecting||this.skipReconnect)return this;const e=this;if(this.backoff.attempts>=this._reconnectionAttempts)this.backoff.reset(),this.emitReserved("reconnect_failed"),this._reconnecting=!1;else{const t=this.backoff.duration();this._reconnecting=!0;const s=this.setTimeoutFn(()=>{e.skipReconnect||(this.emitReserved("reconnect_attempt",e.backoff.attempts),!e.skipReconnect&&e.open(i=>{i?(e._reconnecting=!1,e.reconnect(),this.emitReserved("reconnect_error",i)):e.onreconnect()}))},t);this.opts.autoUnref&&s.unref(),this.subs.push(()=>{this.clearTimeoutFn(s)})}}onreconnect(){const e=this.backoff.attempts;this._reconnecting=!1,this.backoff.reset(),this.emitReserved("reconnect",e)}}const G={};function he(n,e){typeof n=="object"&&(e=n,n=void 0),e=e||{};const t=dn(n,e.path||"/socket.io"),s=t.source,i=t.id,r=t.path,o=G[i]&&r in G[i].nsps,l=e.forceNew||e["force new connection"]||e.multiplex===!1||o;let c;return l?c=new Le(s,e):(G[i]||(G[i]=new Le(s,e)),c=G[i]),t.query&&!e.query&&(e.query=t.queryKey),c.socket(t.path,e)}Object.assign(he,{Manager:Le,Socket:nt,io:he,connect:he});function _n(n,e,t){const s=n.apiBase||window.location.origin,i=he(s,{path:"/livechat-ws",auth:{siteKey:n.siteKey,visitorId:n.visitorId,sessionId:e},transports:["websocket","polling"],reconnection:!0,reconnectionDelay:600,reconnectionDelayMax:8e3});return i.on("livechat:event",r=>{r.sessionId===e&&t(r)}),i}const Sn=`
:host {
  all: initial;
  position: fixed;
  bottom: 40px;
  right: 40px;
  z-index: 2147483646;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 14px;
  color: #1f2937;
  --lc-brand: var(--lc-brand);
  --lc-brand-shadow: var(--lc-brand-shadow);
  --lc-brand-shadow-hover: var(--lc-brand-shadow-hover);
}
:host(.lc-position-left) {
  right: auto;
  left: 40px;
}

/* ── Bubble button ── */
.lc-bubble {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--lc-brand);
  color: #fff;
  border: 0;
  cursor: pointer;
  box-shadow: 0 6px 20px var(--lc-brand-shadow);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
  touch-action: manipulation;
}
.lc-bubble:hover { transform: translateY(-2px); box-shadow: 0 10px 24px var(--lc-brand-shadow-hover); }
.lc-bubble svg { width: 24px; height: 24px; }

.lc-unread {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #ef4444;
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
}

/* ── Panel ── */
.lc-panel {
  position: absolute;
  bottom: 70px;
  right: 0;
  width: 370px;
  height: 580px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.16);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: lc-slide-in 0.22s ease;
}
:host(.lc-position-left) .lc-panel { right: auto; left: 0; }

@keyframes lc-slide-in {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes lc-slide-out {
  from { opacity: 1; transform: translateY(0); }
  to   { opacity: 0; transform: translateY(12px); }
}
.lc-panel--closing { animation: lc-slide-out 0.18s ease forwards; }

/* ── Header ── */
.lc-header {
  padding: 14px 16px;
  background: var(--lc-brand);
  background-image: radial-gradient(circle, rgba(255,255,255,0.18) 1px, transparent 1px);
  background-size: 18px 18px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}
.lc-header-inner { display: flex; align-items: center; gap: 10px; min-width: 0; }
.lc-header-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
  border: 2px solid rgba(255,255,255,0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.lc-header-avatar svg { width: 20px; height: 20px; }
.lc-header-avatars { display: flex; align-items: center; flex-shrink: 0; position: relative; }
.lc-op-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.85);
  object-fit: cover;
  flex-shrink: 0;
  position: relative;
}
.lc-op-initials {
  background: rgba(255,255,255,0.22);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.lc-header-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.lc-header-title { font-weight: 600; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lc-header-sub { font-size: 12px; opacity: 0.9; display: flex; align-items: center; gap: 5px; }
.lc-online-dot { width: 7px; height: 7px; background: #22c55e; border-radius: 50%; flex-shrink: 0; display: inline-block; }

.lc-header-actions { display: flex; align-items: center; gap: 6px; position: relative; }

.lc-newchat-btn,
.lc-close, .lc-menu-btn {
  background: rgba(255,255,255,0.15);
  border: 0;
  color: #fff;
  cursor: pointer;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s;
  padding: 0;
}
.lc-newchat-btn:hover,
.lc-close:hover, .lc-menu-btn:hover { background: rgba(255,255,255,0.28); }
.lc-newchat-btn svg,
.lc-close svg, .lc-menu-btn svg { width: 16px; height: 16px; }

.lc-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  background: #fff;
  color: #111827;
  border-radius: 10px;
  box-shadow: 0 12px 28px rgba(0,0,0,0.18);
  min-width: 220px;
  padding: 6px;
  z-index: 10;
}
.lc-menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  font-size: 13px;
  border-radius: 6px;
  cursor: pointer;
}
.lc-menu-item:hover { background: #f3f4f6; }
.lc-menu-item svg { width: 14px; height: 14px; flex-shrink: 0; color: #6b7280; }

.lc-md-code {
  background: rgba(0,0,0,0.06);
  border-radius: 4px;
  padding: 1px 5px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.92em;
}

.lc-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}
.lc-chip {
  background: #fff;
  border: 1px solid var(--lc-brand, #2563eb);
  color: var(--lc-brand, #2563eb);
  border-radius: 16px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.lc-chip:hover {
  background: var(--lc-brand, #2563eb);
  color: #fff;
}

.lc-feedback {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(0,0,0,0.04);
  padding: 6px 10px;
  border-radius: 10px;
  margin: 8px auto;
}
.lc-feedback span { font-size: 12px; color: #4b5563; }
.lc-fb-btn {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 14px;
  cursor: pointer;
  transition: transform 0.1s;
}
.lc-fb-btn:hover { transform: scale(1.15); }

.lc-emoji-btn {
  background: transparent;
  border: 0;
  color: #6b7280;
  cursor: pointer;
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  flex-shrink: 0;
  transition: background 0.15s;
}
.lc-emoji-btn:hover { background: #f3f4f6; color: #111827; }
.lc-emoji-btn svg { width: 18px; height: 18px; }

.lc-emoji-pop {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 8px;
  width: 280px;
  max-width: calc(100% - 16px);
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 12px 28px rgba(0,0,0,0.15);
  z-index: 12;
  overflow: hidden;
}
.lc-emoji-tabs {
  display: flex;
  border-bottom: 1px solid #e5e7eb;
  overflow-x: auto;
}
.lc-emoji-tab {
  background: transparent;
  border: 0;
  padding: 8px 10px;
  font-size: 11px;
  color: #6b7280;
  cursor: pointer;
  white-space: nowrap;
  border-bottom: 2px solid transparent;
}
.lc-emoji-tab:hover { color: #111827; }
.lc-emoji-tab-active { color: #111827; border-bottom-color: var(--lc-brand, #2563eb); font-weight: 600; }
.lc-emoji-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 2px;
  padding: 8px;
  max-height: 220px;
  overflow-y: auto;
}
.lc-emoji-pick {
  background: transparent;
  border: 0;
  padding: 4px;
  font-size: 18px;
  cursor: pointer;
  border-radius: 4px;
  line-height: 1;
}
.lc-emoji-pick:hover { background: #f3f4f6; }

.lc-composer { position: relative; }

/* ── Messages area ── */
.lc-messages-wrap { flex: 1; overflow: hidden; position: relative; min-height: 0; }

.lc-messages {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px 14px;
  background: #f9fafb;
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-sizing: border-box;
}
.lc-messages::-webkit-scrollbar { width: 4px; }
.lc-messages::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 2px; }

/* ── Message rows ── */
.lc-msg-row { display: flex; align-items: flex-end; gap: 7px; max-width: 86%; }
.lc-msg-row-agent { align-self: flex-start; }
.lc-msg-row-visitor { align-self: flex-end; flex-direction: row-reverse; }

.lc-msg-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--lc-brand);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-bottom: 2px;
}
.lc-msg-avatar svg { width: 13px; height: 13px; }
.lc-msg-avatar-op { background: #374151; font-size: 10px; font-weight: 700; letter-spacing: 0.02em; }
.lc-msg-avatar-ai { background: var(--lc-brand); }
.lc-msg-avatar-img { object-fit: cover; padding: 0; }

.lc-msg-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.lc-msg-row-visitor .lc-msg-body { align-items: flex-end; }

.lc-msg-sender { font-size: 11px; color: #6b7280; font-weight: 500; padding: 0 3px; }
.lc-msg-time { font-size: 10px; color: #9ca3af; padding: 0 3px; }

.lc-msg { padding: 9px 13px; border-radius: 16px; font-size: 14px; line-height: 1.45; word-wrap: break-word; }
.lc-msg.lc-msg-visitor { background: var(--lc-brand); color: #fff; border-bottom-right-radius: 4px; }
.lc-msg.lc-msg-agent { background: #fff; color: #1f2937; border: 1px solid #e5e7eb; border-bottom-left-radius: 4px; }
.lc-msg.lc-msg-system { align-self: center; font-size: 11px; color: #9ca3af; background: transparent; padding: 4px 0; }
.lc-msg a { color: inherit; text-decoration: underline; word-break: break-all; }
.lc-msg.lc-msg-agent a { color: #2563eb; }
.lc-empty { text-align: center; color: #9ca3af; font-size: 13px; padding: 32px 16px; line-height: 1.5; }

/* ── Typing indicator ── */
.lc-typing {
  align-self: flex-start;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  border-bottom-left-radius: 4px;
  padding: 10px 14px;
  display: flex;
  gap: 4px;
  margin-left: 33px;
}
.lc-typing span { width: 6px; height: 6px; background: #9ca3af; border-radius: 50%; animation: lc-bounce 1.2s infinite ease-in-out; }
.lc-typing span:nth-child(2) { animation-delay: 0.15s; }
.lc-typing span:nth-child(3) { animation-delay: 0.3s; }
@keyframes lc-bounce { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }

/* ── Scroll-to-bottom button ── */
.lc-scroll-btn {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  background: #fff;
  color: #374151;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  padding: 5px 14px;
  font-size: 12px;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(0,0,0,0.12);
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 5px;
}
.lc-scroll-btn:hover { background: #f9fafb; }
.lc-scroll-btn svg { width: 13px; height: 13px; color: #6b7280; }

/* ── Toast notification ── */
.lc-toast {
  padding: 8px 14px;
  background: #1f2937;
  color: #f9fafb;
  font-size: 12px;
  text-align: center;
  flex-shrink: 0;
}

/* ── Quick replies ── */
.lc-quick-replies {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px 14px 8px;
  background: #f9fafb;
  flex-shrink: 0;
}
.lc-quick-replies button {
  background: #fff;
  border: 1px solid var(--lc-brand);
  color: var(--lc-brand);
  padding: 6px 14px;
  font-size: 13px;
  border-radius: 999px;
  cursor: pointer;
  font: inherit;
  font-weight: 500;
  transition: background 0.15s, color 0.15s;
}
.lc-quick-replies button:hover { background: var(--lc-brand); color: #fff; }
.lc-quick-replies button:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── Email + name identify ── */
.lc-identify {
  padding: 12px 14px;
  border-top: 1px solid #e5e7eb;
  background: #fff;
  font-size: 13px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.lc-identify-label { font-size: 12px; color: #6b7280; }
.lc-identify-row { display: flex; gap: 6px; }
.lc-identify input { flex: 1; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; outline: none; font: inherit; }
.lc-identify input:focus { border-color: var(--lc-brand); }
.lc-identify button { background: var(--lc-brand); color: #fff; border: 0; border-radius: 6px; padding: 0 12px; font-size: 13px; cursor: pointer; white-space: nowrap; }
.lc-identify-skip { background: transparent !important; color: #9ca3af !important; font-size: 12px !important; padding: 2px 0 0 0 !important; cursor: pointer; border: 0; }

/* ── Pending attachments ── */
.lc-pending { display: flex; flex-wrap: wrap; gap: 6px; padding: 6px 12px 0 12px; background: #fff; flex-shrink: 0; }
.lc-chip { display: inline-flex; align-items: center; gap: 6px; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 10px; padding: 4px 8px; font-size: 12px; color: #1f2937; max-width: 240px; }
.lc-chip--busy { opacity: 0.6; }
.lc-chip-thumb { width: 36px; height: 36px; object-fit: cover; border-radius: 6px; flex-shrink: 0; }
.lc-chip-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lc-chip-uploading { color: #6b7280; font-style: italic; }
.lc-chip button { background: transparent; border: 0; padding: 0 0 0 2px; cursor: pointer; color: #6b7280; font-size: 14px; line-height: 1; }
.lc-chip button:hover { color: #1f2937; }

/* ── Session ended banner ── */
.lc-session-end {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px;
  background: #fef9ec;
  border-top: 1px solid #fde68a;
  font-size: 12px;
  color: #92400e;
  flex-shrink: 0;
}
.lc-session-end-btn {
  background: #1f2937;
  color: #fff;
  border: 0;
  border-radius: 6px;
  padding: 5px 12px;
  font-size: 12px;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}
.lc-session-end-btn:hover { background: #374151; }

/* ── Composer ── */
.lc-composer {
  border-top: 1px solid #e5e7eb;
  background: #fff;
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  align-items: flex-end;
  flex-shrink: 0;
}
.lc-composer textarea {
  flex: 1;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  padding: 8px 10px;
  resize: none;
  font: inherit;
  font-size: 14px;
  outline: none;
  min-height: 36px;
  max-height: 120px;
  line-height: 1.4;
  color: inherit;
}
.lc-composer textarea:focus { border-color: var(--lc-brand); }
.lc-composer button {
  background: var(--lc-brand);
  color: #fff;
  border: 0;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}
.lc-composer button:disabled { opacity: 0.4; cursor: not-allowed; }
.lc-composer button svg { width: 16px; height: 16px; }

/* ── Honeypot ── */
.lc-hp { position: absolute; left: -9999px; top: -9999px; width: 1px; height: 1px; opacity: 0; }

/* ── Attach button ── */
.lc-attach-btn { background: transparent; border: 0; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #6b7280; cursor: pointer; flex-shrink: 0; }
.lc-attach-btn:hover { background: #f3f4f6; color: #1f2937; }
.lc-attach-btn svg { width: 18px; height: 18px; }

/* ── Attachments in messages ── */
.lc-attachments { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }
.lc-attach-img { display: block; width: 100%; max-width: 220px; min-width: 80px; min-height: 60px; max-height: 200px; object-fit: contain; border-radius: 10px; cursor: zoom-in; background: #f3f4f6; }
.lc-attach-file { display: inline-flex; align-items: center; gap: 8px; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 10px; padding: 6px 10px; font-size: 12px; color: #1f2937; text-decoration: none; max-width: 240px; }
.lc-attach-file:hover { background: #e5e7eb; }
.lc-attach-file svg { width: 16px; height: 16px; flex-shrink: 0; color: #6b7280; }
.lc-attach-file span:first-of-type { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.lc-attach-file .lc-attach-size { color: #6b7280; flex-shrink: 0; }

/* ── Per-message rating ── */
.lc-msg-rating {
  display: flex;
  gap: 4px;
  margin-top: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}
.lc-msg-row:hover .lc-msg-rating { opacity: 1; }
.lc-rate-btn {
  background: transparent;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 2px 6px;
  font-size: 13px;
  cursor: pointer;
  line-height: 1;
  transition: background 0.12s, border-color 0.12s;
}
.lc-rate-btn:hover:not(:disabled) { background: #f3f4f6; border-color: #d1d5db; }
.lc-rate-btn:disabled { cursor: default; opacity: 0.5; }
.lc-rate-btn--active { background: #f0fdf4; border-color: #86efac; }

/* ── Proactive bubble ── */
.lc-proactive {
  position: absolute;
  bottom: 70px;
  right: 0;
  max-width: 280px;
  background: #fff;
  border-radius: 12px 12px 4px 12px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.16);
  padding: 12px 36px 12px 14px;
  font-size: 14px;
  color: #1f2937;
  line-height: 1.45;
  animation: lc-slide-in 0.3s ease;
}
.lc-proactive-text { cursor: pointer; }
.lc-proactive-text:hover { text-decoration: underline; }
.lc-proactive-close {
  position: absolute;
  top: 6px;
  right: 8px;
  background: transparent;
  border: 0;
  color: #9ca3af;
  font-size: 14px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.lc-proactive-close:hover { color: #374151; background: #f3f4f6; }

/* ── Mobile ── */
/* On mobile the host is sized via the Visual Viewport API so it tracks
   exactly the visible area — URL bar, keyboard, and safe-area are all
   accounted for in JS. The panel fills 100% of that host element. */
@media (max-width: 480px) {
  .lc-panel {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
    border-radius: 0;
    /* Block touch events from reaching the page behind the panel. */
    touch-action: none;
  }
  /* Safe-area insets: notch / status bar (top) and home indicator (bottom). */
  .lc-header {
    padding-top: calc(14px + env(safe-area-inset-top, 0px));
  }
  .lc-composer {
    padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px));
  }
  /* Allow vertical scroll in the messages area only. */
  .lc-messages {
    touch-action: pan-y;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
  }
  /* Prevent iOS Safari from zooming in when an input is focused.
     Any font-size below 16px triggers the auto-zoom. */
  .lc-composer textarea,
  .lc-identify input {
    font-size: 16px;
  }
  /* Expand tap targets to the 44px minimum recommended for touch. */
  .lc-close {
    width: 44px;
    height: 44px;
  }
  .lc-attach-btn {
    width: 44px;
    height: 44px;
  }
  /* Prevent double-tap zoom on all interactive elements. */
  .lc-close, .lc-menu-btn, .lc-newchat-btn,
  .lc-attach-btn, .lc-emoji-btn,
  .lc-rate-btn, .lc-chip, .lc-fb-btn,
  .lc-quick-replies button, .lc-session-end-btn {
    touch-action: manipulation;
  }
  /* Rating buttons: always visible on touch (no hover state). */
  .lc-msg-rating {
    opacity: 1;
  }
  /* Proactive bubble: keep it within the viewport on narrow screens. */
  .lc-proactive {
    max-width: calc(100vw - 60px);
    right: 0;
  }
  /* Emoji picker: clamp width so it never overflows the panel edge. */
  .lc-emoji-pop {
    left: 0;
    right: 0;
    width: auto;
    max-width: 100%;
    border-radius: 12px 12px 0 0;
    bottom: calc(100% + 4px);
  }
}

/* Landscape + soft keyboard: very short viewport — tighten spacing so the
   composer stays visible without sacrificing the message area. */
@media (max-width: 480px) and (max-height: 400px) {
  .lc-header { padding-top: calc(8px + env(safe-area-inset-top, 0px)); padding-bottom: 8px; }
  .lc-messages { padding: 6px 12px; }
  .lc-composer { padding-top: 6px; padding-bottom: calc(6px + env(safe-area-inset-bottom, 0px)); }
}
`,Be=[{name:"Smileys",emojis:["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","😐","😑","😶","🙄","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🤐","🤨","😐","😑","😶","😏","😴","🤤","😪","😵","🤐","🥴","🤢","🤮","🤧","😷"]},{name:"Hearts",emojis:["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟"]},{name:"Hands",emojis:["👍","👎","👌","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","👋","🤚","🖐️","✋","🖖","👏","🙌","🤝","🙏","✍️","💪","🦾"]},{name:"Objects",emojis:["🔥","✨","🎉","🎊","🎁","🏆","🥇","⭐","🌟","💫","💥","💯","✅","❌","⚠️","❓","❗","💡","📌","📎","🔗","🔒","🔑","⏰","⏳","📅","📆","🗓️","📊","📈"]},{name:"Travel",emojis:["🚀","✈️","🚗","🚕","🚙","🚌","🏠","🏢","🏥","🏦","🏪","🏫","⛺","🌍","🌎","🌏","🗺️","🏖️","🏔️","🌋"]}],En=[[":)","🙂"],[":-)","🙂"],[":D","😄"],[":-D","😄"],["xD","😆"],["XD","😆"],[":P","😛"],[":p","😋"],[":-P","😛"],[":'(","😢"],[":(","🙁"],[":-(","🙁"],[";)","😉"],[";-)","😉"],[":O","😮"],[":o","😮"],[":-O","😮"],[":oO","😳"],[":|","😐"],[":-|","😐"],[":/","😕"],[":-/","😕"],["<3","❤️"],["</3","💔"],[":*","😘"],["B)","😎"]];function Tn(n){let e=n;for(const[t,s]of En){const i=t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),r=new RegExp(`(^|\\s)${i}(?=\\s|$|[.,!?])`,"g");e=e.replace(r,`$1${s}`)}return e}const An={siteKey:"",botName:"Hi there",botSubtitle:"We typically reply in a few seconds.",welcomeMessage:null,brandColor:"#2563eb",position:"bottom-right"},Re="livechat_messages_cache",Ce="livechat_session_id",pe="livechat_identify_dismissed",st="livechat_send_log",ue="livechat_proactive_seen",In=30,On=6e4;function Ln(n,e=An){var u,S;const t=document.createElement("div");t.id="livechat-widget-root",t.style.cssText="position: fixed; bottom: 40px; right: 40px; z-index: 2147483646;",document.body.appendChild(t);const s=t.attachShadow({mode:"open"}),i=(u=jn(e.brandColor))!=null?u:"#2563eb",r=lt(i,.35),o=lt(i,.45);t.style.setProperty("--lc-brand",i),t.style.setProperty("--lc-brand-shadow",r),t.style.setProperty("--lc-brand-shadow-hover",o),e.position==="bottom-left"&&t.classList.add("lc-position-left");const l=document.createElement("style");l.textContent=Sn,s.appendChild(l);const c={open:!1,sessionId:qn(),messages:Pn(),socket:null,panel:null,askedForEmail:!1,unread:0,sessionClosed:!1,feedbackAsked:!1,operators:(S=e.operators)!=null?S:[],host:t,cfg:n},b=document.createElement("button");b.className="lc-bubble",b.innerHTML=Yn(),s.appendChild(b);const f=document.createElement("span");f.className="lc-unread",f.style.display="none",b.appendChild(f);const x=document.createElement("div");if(x.className="lc-proactive",x.style.display="none",e.welcomeMessage){x.innerHTML=`
      <button class="lc-proactive-close" aria-label="Dismiss">&#x2715;</button>
      <div class="lc-proactive-text">${T(e.welcomeMessage)}</div>
    `,s.appendChild(x);let k=!1;try{k=!!sessionStorage.getItem(ue)}catch(H){}k||setTimeout(()=>{c.open||(x.style.display="block")},1500),x.querySelector(".lc-proactive-close").addEventListener("click",H=>{H.stopPropagation(),x.style.display="none";try{sessionStorage.setItem(ue,"1")}catch(te){}}),x.querySelector(".lc-proactive-text").addEventListener("click",()=>{x.style.display="none";try{sessionStorage.setItem(ue,"1")}catch(H){}b.click()})}c.messages.length===0&&e.welcomeMessage&&(c.messages.push({id:"welcome",role:"agent",content:e.welcomeMessage,createdAt:new Date().toISOString()}),W(c.messages));const m=Bn(s,n,c,D,e);m.style.display="none",c.panel=m,m._state=c,m._cfg=n;const A=()=>window.innerWidth<=480,R="position: fixed; bottom: 40px; right: 40px; z-index: 2147483646;";function h(){const k=window.visualViewport;k?t.style.cssText=`position: fixed; top: ${k.offsetTop}px; left: ${k.offsetLeft}px; width: ${k.width}px; height: ${k.height}px; z-index: 2147483646;`:t.style.cssText="position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 2147483646;"}let j=!1;function U(){if(j||!window.visualViewport)return;j=!0;const k=()=>{c.open&&(A()?h():t.style.cssText=R)};window.visualViewport.addEventListener("resize",k),window.visualViewport.addEventListener("scroll",k)}b.addEventListener("click",()=>{x.style.display="none";try{sessionStorage.setItem(ue,"1")}catch(k){}if(c.open=!c.open,c.open){A()&&(h(),U()),m.classList.remove("lc-panel--closing"),m.style.display="flex",c.unread=0,f.style.display="none";const k=m.querySelector("textarea");k==null||k.focus(),rt(m)}else m.classList.add("lc-panel--closing"),setTimeout(()=>{c.open||(m.style.display="none",A()&&(t.style.cssText=R)),m.classList.remove("lc-panel--closing")},180)}),c.sessionId&&it(n,c,D,e);function D(){Rn(m,c),!c.open&&c.unread>0?(f.textContent=String(Math.min(c.unread,99)),f.style.display="flex"):f.style.display="none"}D()}function Bn(n,e,t,s,i){var kt;const r=document.createElement("div");r.className="lc-panel",r.innerHTML=`
    <div class="lc-header">
      <div class="lc-header-inner">
        ${ns((kt=i.operators)!=null?kt:[])}
        <div class="lc-header-text">
          <div class="lc-header-title">${T(i.operatorName||i.botName)}</div>
          <div class="lc-header-sub"><span class="lc-online-dot"></span>${T(i.botSubtitle)}</div>
        </div>
      </div>
      <div class="lc-header-actions">
        <button class="lc-newchat-btn" aria-label="Start new conversation">${ts()}</button>
        <button class="lc-menu-btn" aria-label="Conversation menu" aria-haspopup="true">${Xn()}</button>
        <div class="lc-menu" role="menu" style="display:none;">
          <button class="lc-menu-item" data-action="new">${Qn()} Start a new conversation</button>
          <button class="lc-menu-item" data-action="close">${Gn()} End this chat</button>
        </div>
        <button class="lc-close" aria-label="Close">${ht()}</button>
      </div>
    </div>
    <div class="lc-messages-wrap">
      <div class="lc-messages"></div>
      <button class="lc-scroll-btn" type="button" style="display:none;" aria-label="Scroll to latest">${ht()} New messages</button>
    </div>
    <div class="lc-quick-replies" style="display:none;"></div>
    <div class="lc-toast" role="alert" style="display:none;"></div>
    <div class="lc-identify" style="display:none;">
      <div class="lc-identify-label">Share your details so we can follow up if needed.</div>
      <div class="lc-identify-row">
        <input class="lc-identify-name" type="text" placeholder="Your name" />
      </div>
      <div class="lc-identify-row">
        <input type="email" placeholder="your@email.com" />
        <button>Save</button>
      </div>
      <button class="lc-identify-skip">Skip</button>
    </div>
    <div class="lc-pending" style="display:none;"></div>
    <div class="lc-session-end" style="display:none;">
      <span>This conversation has ended.</span>
      <button type="button" class="lc-session-end-btn">Start new chat</button>
    </div>
    <form class="lc-composer" autocomplete="off">
      <input class="lc-hp" name="website" tabindex="-1" autocomplete="off" />
      <input class="lc-file-input" type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" style="display:none;" />
      <button type="button" class="lc-attach-btn" aria-label="Attach file">${Vn()}</button>
      <button type="button" class="lc-emoji-btn" aria-label="Insert emoji">${Zn()}</button>
      <div class="lc-emoji-pop" style="display:none;" role="dialog" aria-label="Emoji picker">
        <div class="lc-emoji-tabs">${Be.map((a,d)=>`<button type="button" class="lc-emoji-tab${d===0?" lc-emoji-tab-active":""}" data-cat="${d}">${a.name}</button>`).join("")}</div>
        <div class="lc-emoji-grid">${Be[0].emojis.map(a=>`<button type="button" class="lc-emoji-pick" data-emoji="${a}">${a}</button>`).join("")}</div>
      </div>
      <textarea placeholder="Type your message…" rows="1"></textarea>
      <button type="submit" aria-label="Send">${Jn()}</button>
    </form>
  `,n.appendChild(r);const o="position: fixed; bottom: 40px; right: 40px; z-index: 2147483646;";r.querySelector(".lc-newchat-btn").addEventListener("click",()=>{confirm("Start a new conversation? The current chat will be cleared.")&&me()}),r.querySelector(".lc-close").addEventListener("click",()=>{t.open=!1,r.classList.add("lc-panel--closing"),setTimeout(()=>{t.open||(r.style.display="none",window.innerWidth<=480&&(t.host.style.cssText=o)),r.classList.remove("lc-panel--closing")},180)});const b=r.querySelector(".lc-menu-btn"),f=r.querySelector(".lc-menu"),x=()=>{f.style.display="none"};b.addEventListener("click",a=>{a.stopPropagation(),f.style.display=f.style.display==="none"?"block":"none"}),r.addEventListener("click",a=>{!f.contains(a.target)&&a.target!==b&&x()}),f.addEventListener("click",async a=>{const d=a.target.closest(".lc-menu-item");if(!d)return;x();const p=d.getAttribute("data-action");if(p==="new"){if(!confirm("Start a new conversation? The current chat will be cleared."))return;me()}else if(p==="close"){if(!confirm("End this chat? You can always start a new one."))return;const w=t.sessionId;if(w)try{await fetch(`${e.apiBase}/livechat/session/${encodeURIComponent(w)}/close`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({siteKey:e.siteKey,visitorId:e.visitorId}),credentials:"omit"})}catch(v){}me(),t.messages=[{id:`system-${Date.now()}`,role:"system",content:"Chat ended. Type a message to start a new conversation.",createdAt:new Date().toISOString()}],W(t.messages),s()}});const m=r.querySelector(".lc-messages"),A=r.querySelector(".lc-scroll-btn");m.addEventListener("scroll",()=>{const a=m.scrollHeight-m.scrollTop-m.clientHeight;A.style.display=a>120?"flex":"none"}),A.addEventListener("click",()=>{m.scrollTop=m.scrollHeight,A.style.display="none"});const R=r.querySelector(".lc-composer"),h=r.querySelector("textarea"),j=r.querySelector(".lc-hp"),U=r.querySelector('.lc-composer button[type="submit"]'),D=r.querySelector(".lc-attach-btn"),u=r.querySelector(".lc-file-input"),S=r.querySelector(".lc-pending"),k=r.querySelector(".lc-quick-replies"),H=r.querySelector(".lc-session-end"),te=r.querySelector(".lc-session-end-btn"),yt=r.querySelector(".lc-emoji-btn"),ge=r.querySelector(".lc-emoji-pop"),bt=r.querySelector(".lc-emoji-tabs"),xt=r.querySelector(".lc-emoji-grid");function us(a){var v,y;const d=(v=h.selectionStart)!=null?v:h.value.length,p=(y=h.selectionEnd)!=null?y:d;h.value=h.value.slice(0,d)+a+h.value.slice(p);const w=d+a.length;h.setSelectionRange(w,w),h.focus()}function fs(a){const d=Be[a];d&&(xt.innerHTML=d.emojis.map(p=>`<button type="button" class="lc-emoji-pick" data-emoji="${p}">${p}</button>`).join(""))}yt.addEventListener("click",a=>{a.stopPropagation(),ge.style.display=ge.style.display==="none"?"block":"none"}),r.addEventListener("click",a=>{a.target instanceof Node&&!ge.contains(a.target)&&a.target!==yt&&(ge.style.display="none")}),bt.addEventListener("click",a=>{var p;const d=a.target.closest(".lc-emoji-tab");d&&(bt.querySelectorAll(".lc-emoji-tab").forEach(w=>w.classList.remove("lc-emoji-tab-active")),d.classList.add("lc-emoji-tab-active"),fs(Number((p=d.getAttribute("data-cat"))!=null?p:0)))}),xt.addEventListener("click",a=>{var p;const d=a.target.closest(".lc-emoji-pick");d&&us((p=d.getAttribute("data-emoji"))!=null?p:"")}),h.addEventListener("input",()=>{var p;const a=h.value,d=Tn(a);if(d!==a){const w=d.length-a.length,v=((p=h.selectionStart)!=null?p:a.length)+w;h.value=d,h.setSelectionRange(v,v)}});function me(){var a;(a=t.socket)==null||a.disconnect(),t.socket=null,t.sessionId=null,t.sessionClosed=!1,t.messages=[],t.askedForEmail=!1,t.unread=0;try{localStorage.removeItem(Ce)}catch(d){}try{localStorage.removeItem(Re)}catch(d){}try{localStorage.removeItem(pe)}catch(d){}H.style.display="none",h.disabled=!1,U.disabled=!1,D.disabled=!1,i!=null&&i.welcomeMessage&&(t.messages.push({id:"welcome",role:"agent",content:i.welcomeMessage,createdAt:new Date().toISOString()}),W(t.messages)),s()}te.addEventListener("click",me);const E=[],gs=Date.now();let Ne=!1;h.addEventListener("keydown",()=>{Ne=!0}),h.addEventListener("input",()=>{Ne=!0});const vt=()=>{var p;const a=t.messages.some(w=>w.role==="visitor"),d=((p=i.welcomeQuickReplies)!=null?p:[]).filter(Boolean);if(a||d.length===0){k.style.display="none",k.innerHTML="";return}k.style.display="flex",k.innerHTML=d.map((w,v)=>`<button data-i="${v}" type="button">${T(w)}</button>`).join(""),k.querySelectorAll("button").forEach(w=>{w.addEventListener("click",()=>{const v=Number(w.dataset.i),y=d[v];y&&(h.value=y,R.requestSubmit())})})};D.addEventListener("click",()=>u.click()),u.addEventListener("change",async()=>{var w;const a=(w=u.files)==null?void 0:w[0];if(u.value="",!a)return;if(a.size>10*1024*1024){N(r,`File too large: ${a.name} (max 10 MB)`);return}if(E.length>=5){N(r,"You can attach up to 5 files per message.");return}if(!t.sessionId){N(r,"Send a message first, then attach files.");return}const d=a.type.startsWith("image/")?URL.createObjectURL(a):void 0,p={id:"pending-"+Date.now(),mimeType:a.type,sizeBytes:a.size,originalFilename:a.name,url:"",localUrl:d};E.push(p),F();try{const v=await I(e,t.sessionId,a),y=E.indexOf(p);y>=0&&(E[y]=X(K({},v),{localUrl:d})),F()}catch(v){const y=E.indexOf(p);y>=0&&E.splice(y,1),d&&URL.revokeObjectURL(d),N(r,`Upload failed: ${v.message}`),F()}});function F(){if(!E.length){S.style.display="none",S.innerHTML="";return}S.style.display="flex",S.innerHTML=E.map((a,d)=>{var V;const p=a.id.startsWith("pending-"),w=(V=a.localUrl)!=null?V:"",y=a.mimeType.startsWith("image/")&&w?`<img class="lc-chip-thumb" src="${T(w)}" alt="">`:"",q=p?`${y}<span class="lc-chip-label lc-chip-uploading">Uploading…</span>`:`${y}<span class="lc-chip-label">${T(a.originalFilename)}</span><button data-i="${d}" aria-label="Remove">×</button>`;return`<span class="lc-chip${p?" lc-chip--busy":""}">${q}</span>`}).join(""),S.querySelectorAll("button[data-i]").forEach(a=>{a.addEventListener("click",()=>{const d=Number(a.dataset.i),p=E.splice(d,1)[0];p!=null&&p.localUrl&&URL.revokeObjectURL(p.localUrl),F()})})}let qe=null,wt=!1;const ne=a=>{var d;wt!==a&&(wt=a,(d=t.socket)==null||d.emit("livechat:typing",{on:a}))};h.addEventListener("input",()=>{h.style.height="auto",h.style.height=Math.min(120,h.scrollHeight)+"px",h.value.trim()?(ne(!0),qe&&clearTimeout(qe),qe=setTimeout(()=>ne(!1),1500)):ne(!1)}),h.addEventListener("blur",()=>ne(!1)),h.addEventListener("keydown",a=>{a.key==="Enter"&&!a.shiftKey&&(a.preventDefault(),R.requestSubmit())}),h.addEventListener("paste",async a=>{var w;const d=(w=a.clipboardData)==null?void 0:w.items;if(!d)return;const p=[];for(const v of d)if(v.kind==="file"&&v.type.startsWith("image/")){const y=v.getAsFile();y&&p.push(y)}if(p.length){if(a.preventDefault(),!t.sessionId){N(r,"Send a message first, then paste images.");return}for(const v of p){if(v.size>10*1024*1024){N(r,`Pasted image too large: ${v.name||"image"} (max 10 MB)`);continue}if(E.length>=5)break;const y=v.name?v:new File([v],`pasted-${Date.now()}.png`,{type:v.type}),q=URL.createObjectURL(y),V={id:"pending-"+Math.random().toString(36).slice(2),mimeType:v.type,sizeBytes:v.size,originalFilename:y.name,url:"",localUrl:q};E.push(V),F();try{const Me=await I(e,t.sessionId,y),se=E.indexOf(V);se>=0&&(E[se]=X(K({},Me),{localUrl:q})),F()}catch(Me){const se=E.indexOf(V);se>=0&&E.splice(se,1),URL.revokeObjectURL(q),N(r,`Upload failed: ${Me.message}`),F()}}}}),R.addEventListener("submit",async a=>{var v;if(a.preventDefault(),j.value)return;if(t.sessionClosed){N(r,"This conversation has ended. Start a new chat below.");return}const d=h.value.trim(),p=E.some(y=>y.id.startsWith("pending-")),w=E.filter(y=>y.url&&!y.id.startsWith("pending-"));if(p&&!d){N(r,"Your file is still uploading — please wait or add a message.");return}if(!(!d&&!w.length)){if(!Nn()){N(r,"Slow down — too many messages in the last minute.");return}U.disabled=!0,h.value="",h.style.height="auto",ne(!1),$n(t,d,w),E.length=0,F(),vt(),s(),ot(r);try{const y=await At(e,d,w.map(q=>q.id),{hp:j.value||void 0,elapsedMs:Date.now()-gs,hadInteraction:Ne});if(Z(r),t.sessionId=y.sessionId,Mn(y.sessionId),"content"in y.agent&&y.agent.content){const q=(v=y.agent.id)!=null?v:"";t.messages.some(V=>V.id===q&&q)||at(t,y.agent.content,q)}t.socket||it(e,t,s,i),Cn(r,t)}catch(y){Z(r),N(r,"Could not send — please try again.")}U.disabled=!1,s()}});const J=r.querySelector(".lc-identify"),ms=J.querySelector(".lc-identify-name"),ys=J.querySelector('input[type="email"]'),bs=J.querySelectorAll("button")[0],xs=J.querySelectorAll("button")[1];return bs.addEventListener("click",async()=>{const a=ys.value.trim(),d=ms.value.trim()||void 0;if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a))try{await It(e,{email:a,name:d}),J.style.display="none";try{localStorage.setItem(pe,"saved")}catch(p){}}catch(p){}}),xs.addEventListener("click",()=>{J.style.display="none";try{localStorage.setItem(pe,"skipped")}catch(a){}}),vt(),r}function it(n,e,t,s){!e.sessionId||e.socket||(e.socket=_n(n,e.sessionId,i=>{var c,b,f,x,m,A,R,h,j,U,D;if(i.type==="typing"){const u=e.panel;if(!u)return;i.on?ot(u):Z(u);return}if(i.type==="session_status"&&i.status==="closed"){(c=e.socket)==null||c.disconnect(),e.socket=null,e.sessionClosed=!0;const u=e.panel;if(u){const S=u.querySelector(".lc-session-end"),k=u.querySelector("textarea"),H=u.querySelector('.lc-composer button[type="submit"]'),te=u.querySelector(".lc-attach-btn");S&&(S.style.display="flex"),k&&(k.disabled=!0),H&&(H.disabled=!0),te&&(te.disabled=!0),e.feedbackAsked||(e.feedbackAsked=!0,e.messages.push({id:`feedback-${Date.now()}`,role:"system",content:"__feedback__",createdAt:new Date().toISOString()}))}t();return}if(i.type==="agent_stream_start"&&i.draftId){const u=e.panel;u&&Z(u),e.messages.some(S=>S.id===i.draftId)||(e.messages.push({id:i.draftId,role:"agent",content:"",createdAt:(b=i.createdAt)!=null?b:new Date().toISOString()}),t());return}if(i.type==="agent_stream_delta"&&i.draftId&&i.delta){const u=e.messages.findIndex(S=>S.id===i.draftId);u>=0&&(e.messages[u]=X(K({},e.messages[u]),{content:e.messages[u].content+i.delta}),t());return}if(i.type==="agent_stream_end"&&i.draftId&&i.messageId){const u=e.messages.findIndex(S=>S.id===i.draftId);u>=0&&(e.messages[u]=X(K({},e.messages[u]),{id:i.messageId,content:(f=i.content)!=null?f:e.messages[u].content}),W(e.messages),e.open||(e.unread=((x=e.unread)!=null?x:0)+1,ct()),t());return}if(i.type==="agent_suggestions"&&i.messageId&&((m=i.suggestions)!=null&&m.length)){const u=e.messages.findIndex(S=>S.id===i.messageId);u>=0&&(e.messages[u]=X(K({},e.messages[u]),{suggestions:i.suggestions.slice(0,3)}),t());return}if(i.type!=="message"||!i.messageId||i.role==="visitor"||e.messages.some(u=>u.id===i.messageId))return;const r=(A=i.operatorName)!=null?A:void 0,o=r&&(j=(h=(R=s==null?void 0:s.operators)==null?void 0:R.find(u=>u.name===r))==null?void 0:h.avatarUrl)!=null?j:void 0;at(e,(U=i.content)!=null?U:"",i.messageId,i.role==="operator",i.attachments,r,o);const l=e.panel;l&&Z(l),e.open||(e.unread=((D=e.unread)!=null?D:0)+1,ct()),t()}))}function Rn(n,e){const t=n.querySelector(".lc-messages");if(!t)return;if(e.messages.length===0){t.innerHTML='<div class="lc-empty">Send us a message — we will get right back to you.</div>';return}const s=(()=>{for(let i=e.messages.length-1;i>=0;i--){const r=e.messages[i];if(r.role==="agent"||r.role==="operator")return i;if(r.role==="visitor")return-1}return-1})();t.innerHTML=e.messages.map((i,r)=>{var A,R;const o=i.content?i.role==="visitor"?zn(i.content):Un(i.content):"",l=((A=i.attachments)!=null?A:[]).map(Dn).join(""),c=l?`<div class="lc-attachments">${l}</div>`:"",b=Fn(i.createdAt),f=b?`<div class="lc-msg-time">${b}</div>`:"",x=r===s&&i.suggestions&&i.suggestions.length?`<div class="lc-chips">${i.suggestions.map(h=>`<button class="lc-chip" data-chip="${B(h)}">${T(h)}</button>`).join("")}</div>`:"";if(i.role==="system")return i.content==="__feedback__"?`<div class="lc-msg lc-msg-system lc-feedback" data-feedback-id="${B(i.id)}">
            <span>How was this chat?</span>
            <button class="lc-fb-btn" data-rating="up" aria-label="Good">👍</button>
            <button class="lc-fb-btn" data-rating="down" aria-label="Bad">👎</button>
          </div>`:`<div class="lc-msg lc-msg-system">${o}</div>`;if(i.role==="visitor")return`<div class="lc-msg-row lc-msg-row-visitor">
          <div class="lc-msg-body">
            <div class="lc-msg lc-msg-visitor">${o}${c}</div>
            ${f}
          </div>
        </div>`;const m=i.id&&i.id!=="welcome"?`<div class="lc-msg-rating" data-msg-id="${B(i.id)}">
            <button class="lc-rate-btn" data-rating="up" aria-label="Helpful">&#128077;</button>
            <button class="lc-rate-btn" data-rating="down" aria-label="Not helpful">&#128078;</button>
           </div>`:"";if(i.role==="operator"){const h=(R=i.operatorName)!=null?R:"Operator";return`<div class="lc-msg-row lc-msg-row-agent">
          ${i.operatorAvatarUrl?`<img class="lc-msg-avatar lc-msg-avatar-img" src="${B(i.operatorAvatarUrl)}" alt="${T(h)}">`:`<div class="lc-msg-avatar lc-msg-avatar-op" title="${T(h)}">${T(dt(h))}</div>`}
          <div class="lc-msg-body">
            <div class="lc-msg-sender">${T(h)}</div>
            <div class="lc-msg lc-msg-agent">${o}${c}</div>
            ${f}
            ${x}
            ${m}
          </div>
        </div>`}return`<div class="lc-msg-row lc-msg-row-agent">
        <div class="lc-msg-avatar lc-msg-avatar-ai">${es()}</div>
        <div class="lc-msg-body">
          <div class="lc-msg lc-msg-agent">${o}${c}</div>
          ${f}
          ${x}
          ${m}
        </div>
      </div>`}).join(""),t.querySelectorAll(".lc-msg-rating").forEach(i=>{i.querySelectorAll(".lc-rate-btn").forEach(r=>{r.addEventListener("click",async()=>{var f,x,m;const o=r.getAttribute("data-rating"),l=(f=i.getAttribute("data-msg-id"))!=null?f:"",c=(m=(x=n._state)==null?void 0:x.sessionId)!=null?m:"",b=n._cfg;if(!(!l||!c||!b)){i.querySelectorAll(".lc-rate-btn").forEach(A=>A.disabled=!0),r.classList.add("lc-rate-btn--active");try{await fetch(`${b.apiBase}/livechat/session/${encodeURIComponent(c)}/message/${encodeURIComponent(l)}/rating`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({siteKey:b.siteKey,visitorId:b.visitorId,rating:o}),credentials:"omit"})}catch(A){}}})})}),t.querySelectorAll(".lc-chip").forEach(i=>{i.addEventListener("click",()=>{var c;const r=n.querySelector("textarea"),o=n.querySelector(".lc-composer"),l=(c=i.getAttribute("data-chip"))!=null?c:"";!r||!o||!l||(r.value=l,o.requestSubmit())})}),t.querySelectorAll(".lc-fb-btn").forEach(i=>{i.addEventListener("click",async()=>{const r=i.closest(".lc-feedback"),o=i.getAttribute("data-rating");if(!r||!o)return;const l=e.sessionId,c=e.cfg;if(l&&c)try{await fetch(`${c.apiBase}/livechat/session/${encodeURIComponent(l)}/feedback`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({siteKey:c.siteKey,visitorId:c.visitorId,rating:o}),credentials:"omit"})}catch(b){}r.innerHTML="<span>Thanks for the feedback!</span>"})}),rt(n)}function rt(n){const e=n.querySelector(".lc-messages");e&&(e.scrollTop=e.scrollHeight)}function ot(n){const e=n.querySelector(".lc-messages");if(!e||e.querySelector(".lc-typing"))return;const t=document.createElement("div");t.className="lc-typing",t.innerHTML="<span></span><span></span><span></span>",e.appendChild(t),e.scrollTop=e.scrollHeight}function Z(n){n.querySelectorAll(".lc-typing").forEach(e=>e.remove())}function Cn(n,e){if(e.askedForEmail)return;try{if(localStorage.getItem(pe))return}catch(s){}if(e.messages.filter(s=>s.role==="agent").length<1)return;e.askedForEmail=!0;const t=n.querySelector(".lc-identify");t&&(t.style.display="block")}function $n(n,e,t){n.messages.push({id:"local-"+Date.now(),role:"visitor",content:e,createdAt:new Date().toISOString(),attachments:t}),W(n.messages)}function at(n,e,t,s=!1,i,r,o){n.messages.push({id:t||"srv-"+Date.now(),role:s?"operator":"agent",content:e,createdAt:new Date().toISOString(),attachments:i,operatorName:r,operatorAvatarUrl:o}),W(n.messages)}function Nn(){var n;try{const e=Date.now(),t=JSON.parse((n=localStorage.getItem(st))!=null?n:"[]").filter(s=>e-s<On);return t.length>=In?!1:(t.push(e),localStorage.setItem(st,JSON.stringify(t)),!0)}catch(e){return!0}}function qn(){try{return localStorage.getItem(Ce)}catch(n){return null}}function Mn(n){try{localStorage.setItem(Ce,n)}catch(e){}}function Pn(){try{const n=localStorage.getItem(Re);return n?JSON.parse(n):[]}catch(n){return[]}}function W(n){try{localStorage.setItem(Re,JSON.stringify(n.slice(-50)))}catch(e){}}function ct(){try{const n=new(window.AudioContext||window.webkitAudioContext),e=n.createOscillator(),t=n.createGain();e.connect(t),t.connect(n.destination),e.type="sine",e.frequency.setValueAtTime(880,n.currentTime),e.frequency.setValueAtTime(1100,n.currentTime+.08),t.gain.setValueAtTime(.12,n.currentTime),t.gain.exponentialRampToValueAtTime(.001,n.currentTime+.35),e.start(n.currentTime),e.stop(n.currentTime+.35)}catch(n){}}function T(n){return n.replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}function jn(n){if(!n)return null;const e=n.trim();return/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(e)?e:null}function lt(n,e){let t=n.replace("#","");t.length===3&&(t=t.split("").map(o=>o+o).join(""));const s=parseInt(t.slice(0,2),16),i=parseInt(t.slice(2,4),16),r=parseInt(t.slice(4,6),16);return`rgba(${s}, ${i}, ${r}, ${e})`}function Dn(n){if(n.mimeType.startsWith("image/")&&n.url)return`<a href="${B(n.url)}" target="_blank" rel="noopener noreferrer"><img class="lc-attach-img" src="${B(n.url)}" alt="${B(n.originalFilename)}" /></a>`;const t=Hn(n.sizeBytes);return`<a class="lc-attach-file" href="${n.url?B(n.url):"#"}" target="_blank" rel="noopener noreferrer">${Kn()}<span>${T(n.originalFilename)}</span><span class="lc-attach-size">${t}</span></a>`}function zn(n){return T(n).replace(/(https?:\/\/[^\s<]+)/g,t=>{const s=t.match(/[.,;:!?)]+$/),i=s?s[0]:"",r=i?t.slice(0,-i.length):t;return`<a href="${B(r)}" target="_blank" rel="noopener noreferrer nofollow">${r}</a>${i}`})}function Un(n){let e=T(n);const t=[];return e=e.replace(/`([^`\n]+)`/g,(s,i)=>(t.push(`<code class="lc-md-code">${i}</code>`),`\0C${t.length-1}\0`)),e=e.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,(s,i,r)=>`<a href="${B(r)}" target="_blank" rel="noopener noreferrer nofollow">${i}</a>`),e=e.replace(/\*\*([^*\n]+?)\*\*/g,"<strong>$1</strong>"),e=e.replace(/(^|[\s(])\*([^*\n]+?)\*(?=[\s.,;:!?)]|$)/g,"$1<em>$2</em>"),e=e.replace(/(^|[\s>])(https?:\/\/[^\s<]+)/g,(s,i,r)=>{const o=r.match(/[.,;:!?)]+$/),l=o?o[0]:"",c=l?r.slice(0,-l.length):r;return`${i}<a href="${B(c)}" target="_blank" rel="noopener noreferrer nofollow">${c}</a>${l}`}),e=e.replace(/ C(\d+) /g,(s,i)=>{var r;return(r=t[Number(i)])!=null?r:""}),e=e.replace(/\n/g,"<br>"),e}function B(n){return n.replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}function Hn(n){return n<1024?`${n} B`:n<1024*1024?`${(n/1024).toFixed(0)} KB`:`${(n/1024/1024).toFixed(1)} MB`}function N(n,e,t=3500){const s=n.querySelector(".lc-toast");s&&(s.textContent=e,s.style.display="block",clearTimeout(s._timer),s._timer=setTimeout(()=>{s.style.display="none"},t))}function dt(n){return n.trim().split(/\s+/).map(e=>{var t;return(t=e[0])!=null?t:""}).join("").slice(0,2).toUpperCase()}function Fn(n){try{const e=new Date(n);return isNaN(e.getTime())?"":e.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}catch(e){return""}}function Vn(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 17.93 8.83l-8.58 8.57a2 2 0 1 1-2.83-2.83l8.49-8.48"/></svg>'}function Kn(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>'}function Yn(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'}function Wn(){return'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>'}function ht(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>'}function Jn(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>'}function Xn(){return'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="6" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="18" r="1.5"/></svg>'}function Qn(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15.5-6.36L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.36L3 16"/><path d="M3 21v-5h5"/></svg>'}function Gn(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'}function Zn(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>'}function es(){return'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4M22 5h-4M4 17v2M5 18H3"/></svg>'}function ts(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>'}function ns(n){return n.length?`<div class="lc-header-avatars">${n.slice(0,3).map((s,i)=>{const r=i===0?"":"margin-left:-10px;",o=`z-index:${3-i};`;return s.avatarUrl?`<img class="lc-op-avatar" src="${B(s.avatarUrl)}" alt="${T(s.name)}" style="${o}${r}">`:`<div class="lc-op-avatar lc-op-initials" style="${o}${r}">${T(dt(s.name))}</div>`}).join("")}</div>`:`<div class="lc-header-avatar">${Wn()}</div>`}let pt="",ee=null,fe=null;const ss=3e4;function is(n){ut(n),os(n),window.addEventListener("popstate",()=>$e(n)),window.addEventListener("pagehide",()=>{ee&&Pe(n,ee)}),rs(n)}function rs(n){const e=()=>{document.visibilityState==="visible"&&Tt(n,{url:location.href,title:document.title})};setInterval(e,ss),document.addEventListener("visibilitychange",()=>{document.visibilityState==="visible"&&e()})}function os(n){const e={pushState:history.pushState,replaceState:history.replaceState};history.pushState=function(...t){const s=e.pushState.apply(this,t);return $e(n),s},history.replaceState=function(...t){const s=e.replaceState.apply(this,t);return $e(n),s}}function $e(n){fe&&clearTimeout(fe),fe=setTimeout(()=>ut(n),300)}async function ut(n){var t;fe=null;const e=location.pathname+location.search;if(e!==pt){pt=e,ee&&Pe(n,ee);try{ee=(t=(await Et(n,{url:location.href,path:location.pathname,title:document.title,referrer:document.referrer,language:navigator.language})).pageviewId)!=null?t:null}catch(s){}}}const ft="livechat_visitor_id";function as(){const n=cs();if(!n)return null;const e=n.getAttribute("data-site");if(!e)return null;const t=n.getAttribute("data-api")||ls(n)||"",s=ds();return{siteKey:e,visitorId:s,apiBase:t}}function cs(){const n=document.querySelectorAll("script[data-site]");return n.length?n[n.length-1]:null}function ls(n){if(!n.src)return null;try{const e=new URL(n.src);return`${e.protocol}//${e.host}`}catch(e){return null}}function ds(){try{const n=localStorage.getItem(ft);if(n)return n;const e=gt();return localStorage.setItem(ft,e),e}catch(n){return gt()}}function gt(){if(typeof crypto!="undefined"&&crypto.randomUUID)return crypto.randomUUID();let n=Date.now();return"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,e=>{const t=(n+Math.random()*16)%16|0;return n=Math.floor(n/16),(e==="x"?t:t&3|8).toString(16)})}const mt="livechat_build",hs=["livechat_messages_cache","livechat_session_id","livechat_identify_dismissed","livechat_send_log","livechat_proactive_seen"];function ps(){try{localStorage.getItem(mt)!=="mon3bhiu"&&(hs.forEach(n=>localStorage.removeItem(n)),localStorage.setItem(mt,"mon3bhiu"))}catch(n){}}(function(){var s;if(typeof window=="undefined"||(s=window.__livechat__)!=null&&s.mounted)return;ps();const e=as();if(!e)return;window.__livechat__={mounted:!0,siteKey:e.siteKey,visitorId:e.visitorId},is(e);const t=async()=>{const i=await C(e);Ln(e,i!=null?i:void 0)};document.readyState==="loading"?document.addEventListener("DOMContentLoaded",t):t()})()})();
