var Cs=Object.defineProperty,$s=Object.defineProperties;var Ns=Object.getOwnPropertyDescriptors;var Mt=Object.getOwnPropertySymbols;var qs=Object.prototype.hasOwnProperty,Ms=Object.prototype.propertyIsEnumerable;var Dt=(M,O,L)=>O in M?Cs(M,O,{enumerable:!0,configurable:!0,writable:!0,value:L}):M[O]=L,G=(M,O)=>{for(var L in O||(O={}))qs.call(O,L)&&Dt(M,L,O[L]);if(Mt)for(var L of Mt(O))Ms.call(O,L)&&Dt(M,L,O[L]);return M},te=(M,O)=>$s(M,Ns(O));(function(){"use strict";async function M(n){try{const e=await fetch(`${n.apiBase}/livechat/config?siteKey=${encodeURIComponent(n.siteKey)}`,{method:"GET",credentials:"omit"});return e.ok?await e.json():null}catch(e){return null}}async function O(n,e,t){const s=new FormData;s.append("siteKey",n.siteKey),s.append("visitorId",n.visitorId),s.append("sessionId",e),s.append("file",t,t.name);const i=await fetch(`${n.apiBase}/livechat/upload`,{method:"POST",body:s,credentials:"omit"});if(!i.ok){const r=await i.text().catch(()=>"");throw new Error(`${i.status} ${i.statusText}${r?` — ${r}`:""}`)}return i.json()}async function L(n,e){const t=await fetch(n,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(e),credentials:"omit"});if(!t.ok){const s=await t.text().catch(()=>"");throw new Error(`${t.status} ${t.statusText}${s?` — ${s}`:""}`)}return t.json()}function Pt(n,e){return L(`${n.apiBase}/livechat/track/pageview`,G({siteKey:n.siteKey,visitorId:n.visitorId},e))}function jt(n,e){return L(`${n.apiBase}/livechat/track/heartbeat`,{siteKey:n.siteKey,visitorId:n.visitorId,url:e.url,title:e.title}).catch(()=>{})}function Ke(n,e){const t=`${n.apiBase}/livechat/track/leave`,s=JSON.stringify({siteKey:n.siteKey,visitorId:n.visitorId,pageviewId:e});if(navigator.sendBeacon){const i=new Blob([s],{type:"application/json"});navigator.sendBeacon(t,i);return}fetch(t,{method:"POST",headers:{"Content-Type":"application/json"},body:s,keepalive:!0}).catch(()=>{})}function zt(n,e,t,s){return L(`${n.apiBase}/livechat/message`,{siteKey:n.siteKey,visitorId:n.visitorId,content:e,attachmentIds:t&&t.length?t:void 0,meta:s})}function Ve(n,e){return L(`${n.apiBase}/livechat/identify`,{siteKey:n.siteKey,visitorId:n.visitorId,email:e.email,name:e.name})}const z=Object.create(null);z.open="0",z.close="1",z.ping="2",z.pong="3",z.message="4",z.upgrade="5",z.noop="6";const le=Object.create(null);Object.keys(z).forEach(n=>{le[z[n]]=n});const ke={type:"error",data:"parser error"},Ye=typeof Blob=="function"||typeof Blob!="undefined"&&Object.prototype.toString.call(Blob)==="[object BlobConstructor]",We=typeof ArrayBuffer=="function",Je=n=>typeof ArrayBuffer.isView=="function"?ArrayBuffer.isView(n):n&&n.buffer instanceof ArrayBuffer,Se=({type:n,data:e},t,s)=>Ye&&e instanceof Blob?t?s(e):Xe(e,s):We&&(e instanceof ArrayBuffer||Je(e))?t?s(e):Xe(new Blob([e]),s):s(z[n]+(e||"")),Xe=(n,e)=>{const t=new FileReader;return t.onload=function(){const s=t.result.split(",")[1];e("b"+(s||""))},t.readAsDataURL(n)};function Ge(n){return n instanceof Uint8Array?n:n instanceof ArrayBuffer?new Uint8Array(n):new Uint8Array(n.buffer,n.byteOffset,n.byteLength)}let Ee;function Ut(n,e){if(Ye&&n.data instanceof Blob)return n.data.arrayBuffer().then(Ge).then(e);if(We&&(n.data instanceof ArrayBuffer||Je(n.data)))return e(Ge(n.data));Se(n,!1,t=>{Ee||(Ee=new TextEncoder),e(Ee.encode(t))})}const Qe="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",ne=typeof Uint8Array=="undefined"?[]:new Uint8Array(256);for(let n=0;n<Qe.length;n++)ne[Qe.charCodeAt(n)]=n;const Ht=n=>{let e=n.length*.75,t=n.length,s,i=0,r,o,l,a;n[n.length-1]==="="&&(e--,n[n.length-2]==="="&&e--);const x=new ArrayBuffer(e),m=new Uint8Array(x);for(s=0;s<t;s+=4)r=ne[n.charCodeAt(s)],o=ne[n.charCodeAt(s+1)],l=ne[n.charCodeAt(s+2)],a=ne[n.charCodeAt(s+3)],m[i++]=r<<2|o>>4,m[i++]=(o&15)<<4|l>>2,m[i++]=(l&3)<<6|a&63;return x},Ft=typeof ArrayBuffer=="function",Te=(n,e)=>{if(typeof n!="string")return{type:"message",data:Ze(n,e)};const t=n.charAt(0);return t==="b"?{type:"message",data:Kt(n.substring(1),e)}:le[t]?n.length>1?{type:le[t],data:n.substring(1)}:{type:le[t]}:ke},Kt=(n,e)=>{if(Ft){const t=Ht(n);return Ze(t,e)}else return{base64:!0,data:n}},Ze=(n,e)=>{switch(e){case"blob":return n instanceof Blob?n:new Blob([n]);case"arraybuffer":default:return n instanceof ArrayBuffer?n:n.buffer}},et="",Vt=(n,e)=>{const t=n.length,s=new Array(t);let i=0;n.forEach((r,o)=>{Se(r,!1,l=>{s[o]=l,++i===t&&e(s.join(et))})})},Yt=(n,e)=>{const t=n.split(et),s=[];for(let i=0;i<t.length;i++){const r=Te(t[i],e);if(s.push(r),r.type==="error")break}return s};function Wt(){return new TransformStream({transform(n,e){Ut(n,t=>{const s=t.length;let i;if(s<126)i=new Uint8Array(1),new DataView(i.buffer).setUint8(0,s);else if(s<65536){i=new Uint8Array(3);const r=new DataView(i.buffer);r.setUint8(0,126),r.setUint16(1,s)}else{i=new Uint8Array(9);const r=new DataView(i.buffer);r.setUint8(0,127),r.setBigUint64(1,BigInt(s))}n.data&&typeof n.data!="string"&&(i[0]|=128),e.enqueue(i),e.enqueue(t)})}})}let Ae;function de(n){return n.reduce((e,t)=>e+t.length,0)}function he(n,e){if(n[0].length===e)return n.shift();const t=new Uint8Array(e);let s=0;for(let i=0;i<e;i++)t[i]=n[0][s++],s===n[0].length&&(n.shift(),s=0);return n.length&&s<n[0].length&&(n[0]=n[0].slice(s)),t}function Jt(n,e){Ae||(Ae=new TextDecoder);const t=[];let s=0,i=-1,r=!1;return new TransformStream({transform(o,l){for(t.push(o);;){if(s===0){if(de(t)<1)break;const a=he(t,1);r=(a[0]&128)===128,i=a[0]&127,i<126?s=3:i===126?s=1:s=2}else if(s===1){if(de(t)<2)break;const a=he(t,2);i=new DataView(a.buffer,a.byteOffset,a.length).getUint16(0),s=3}else if(s===2){if(de(t)<8)break;const a=he(t,8),x=new DataView(a.buffer,a.byteOffset,a.length),m=x.getUint32(0);if(m>Math.pow(2,21)-1){l.enqueue(ke);break}i=m*Math.pow(2,32)+x.getUint32(4),s=3}else{if(de(t)<i)break;const a=he(t,i);l.enqueue(Te(r?a:Ae.decode(a),e)),s=0}if(i===0||i>n){l.enqueue(ke);break}}}})}const tt=4;function S(n){if(n)return Xt(n)}function Xt(n){for(var e in S.prototype)n[e]=S.prototype[e];return n}S.prototype.on=S.prototype.addEventListener=function(n,e){return this._callbacks=this._callbacks||{},(this._callbacks["$"+n]=this._callbacks["$"+n]||[]).push(e),this},S.prototype.once=function(n,e){function t(){this.off(n,t),e.apply(this,arguments)}return t.fn=e,this.on(n,t),this},S.prototype.off=S.prototype.removeListener=S.prototype.removeAllListeners=S.prototype.removeEventListener=function(n,e){if(this._callbacks=this._callbacks||{},arguments.length==0)return this._callbacks={},this;var t=this._callbacks["$"+n];if(!t)return this;if(arguments.length==1)return delete this._callbacks["$"+n],this;for(var s,i=0;i<t.length;i++)if(s=t[i],s===e||s.fn===e){t.splice(i,1);break}return t.length===0&&delete this._callbacks["$"+n],this},S.prototype.emit=function(n){this._callbacks=this._callbacks||{};for(var e=new Array(arguments.length-1),t=this._callbacks["$"+n],s=1;s<arguments.length;s++)e[s-1]=arguments[s];if(t){t=t.slice(0);for(var s=0,i=t.length;s<i;++s)t[s].apply(this,e)}return this},S.prototype.emitReserved=S.prototype.emit,S.prototype.listeners=function(n){return this._callbacks=this._callbacks||{},this._callbacks["$"+n]||[]},S.prototype.hasListeners=function(n){return!!this.listeners(n).length};const pe=typeof Promise=="function"&&typeof Promise.resolve=="function"?e=>Promise.resolve().then(e):(e,t)=>t(e,0),C=typeof self!="undefined"?self:typeof window!="undefined"?window:Function("return this")(),Gt="arraybuffer";function Ds(){}function nt(n,...e){return e.reduce((t,s)=>(n.hasOwnProperty(s)&&(t[s]=n[s]),t),{})}const Qt=C.setTimeout,Zt=C.clearTimeout;function ue(n,e){e.useNativeTimers?(n.setTimeoutFn=Qt.bind(C),n.clearTimeoutFn=Zt.bind(C)):(n.setTimeoutFn=C.setTimeout.bind(C),n.clearTimeoutFn=C.clearTimeout.bind(C))}const en=1.33;function tn(n){return typeof n=="string"?nn(n):Math.ceil((n.byteLength||n.size)*en)}function nn(n){let e=0,t=0;for(let s=0,i=n.length;s<i;s++)e=n.charCodeAt(s),e<128?t+=1:e<2048?t+=2:e<55296||e>=57344?t+=3:(s++,t+=4);return t}function st(){return Date.now().toString(36).substring(3)+Math.random().toString(36).substring(2,5)}function sn(n){let e="";for(let t in n)n.hasOwnProperty(t)&&(e.length&&(e+="&"),e+=encodeURIComponent(t)+"="+encodeURIComponent(n[t]));return e}function rn(n){let e={},t=n.split("&");for(let s=0,i=t.length;s<i;s++){let r=t[s].split("=");e[decodeURIComponent(r[0])]=decodeURIComponent(r[1])}return e}class on extends Error{constructor(e,t,s){super(e),this.description=t,this.context=s,this.type="TransportError"}}class Ie extends S{constructor(e){super(),this.writable=!1,ue(this,e),this.opts=e,this.query=e.query,this.socket=e.socket,this.supportsBinary=!e.forceBase64}onError(e,t,s){return super.emitReserved("error",new on(e,t,s)),this}open(){return this.readyState="opening",this.doOpen(),this}close(){return(this.readyState==="opening"||this.readyState==="open")&&(this.doClose(),this.onClose()),this}send(e){this.readyState==="open"&&this.write(e)}onOpen(){this.readyState="open",this.writable=!0,super.emitReserved("open")}onData(e){const t=Te(e,this.socket.binaryType);this.onPacket(t)}onPacket(e){super.emitReserved("packet",e)}onClose(e){this.readyState="closed",super.emitReserved("close",e)}pause(e){}createUri(e,t={}){return e+"://"+this._hostname()+this._port()+this.opts.path+this._query(t)}_hostname(){const e=this.opts.hostname;return e.indexOf(":")===-1?e:"["+e+"]"}_port(){return this.opts.port&&(this.opts.secure&&Number(this.opts.port)!==443||!this.opts.secure&&Number(this.opts.port)!==80)?":"+this.opts.port:""}_query(e){const t=sn(e);return t.length?"?"+t:""}}class an extends Ie{constructor(){super(...arguments),this._polling=!1}get name(){return"polling"}doOpen(){this._poll()}pause(e){this.readyState="pausing";const t=()=>{this.readyState="paused",e()};if(this._polling||!this.writable){let s=0;this._polling&&(s++,this.once("pollComplete",function(){--s||t()})),this.writable||(s++,this.once("drain",function(){--s||t()}))}else t()}_poll(){this._polling=!0,this.doPoll(),this.emitReserved("poll")}onData(e){const t=s=>{if(this.readyState==="opening"&&s.type==="open"&&this.onOpen(),s.type==="close")return this.onClose({description:"transport closed by the server"}),!1;this.onPacket(s)};Yt(e,this.socket.binaryType).forEach(t),this.readyState!=="closed"&&(this._polling=!1,this.emitReserved("pollComplete"),this.readyState==="open"&&this._poll())}doClose(){const e=()=>{this.write([{type:"close"}])};this.readyState==="open"?e():this.once("open",e)}write(e){this.writable=!1,Vt(e,t=>{this.doWrite(t,()=>{this.writable=!0,this.emitReserved("drain")})})}uri(){const e=this.opts.secure?"https":"http",t=this.query||{};return this.opts.timestampRequests!==!1&&(t[this.opts.timestampParam]=st()),!this.supportsBinary&&!t.sid&&(t.b64=1),this.createUri(e,t)}}let it=!1;try{it=typeof XMLHttpRequest!="undefined"&&"withCredentials"in new XMLHttpRequest}catch(n){}const cn=it;function ln(){}class dn extends an{constructor(e){if(super(e),typeof location!="undefined"){const t=location.protocol==="https:";let s=location.port;s||(s=t?"443":"80"),this.xd=typeof location!="undefined"&&e.hostname!==location.hostname||s!==e.port}}doWrite(e,t){const s=this.request({method:"POST",data:e});s.on("success",t),s.on("error",(i,r)=>{this.onError("xhr post error",i,r)})}doPoll(){const e=this.request();e.on("data",this.onData.bind(this)),e.on("error",(t,s)=>{this.onError("xhr poll error",t,s)}),this.pollXhr=e}}class U extends S{constructor(e,t,s){super(),this.createRequest=e,ue(this,s),this._opts=s,this._method=s.method||"GET",this._uri=t,this._data=s.data!==void 0?s.data:null,this._create()}_create(){var e;const t=nt(this._opts,"agent","pfx","key","passphrase","cert","ca","ciphers","rejectUnauthorized","autoUnref");t.xdomain=!!this._opts.xd;const s=this._xhr=this.createRequest(t);try{s.open(this._method,this._uri,!0);try{if(this._opts.extraHeaders){s.setDisableHeaderCheck&&s.setDisableHeaderCheck(!0);for(let i in this._opts.extraHeaders)this._opts.extraHeaders.hasOwnProperty(i)&&s.setRequestHeader(i,this._opts.extraHeaders[i])}}catch(i){}if(this._method==="POST")try{s.setRequestHeader("Content-type","text/plain;charset=UTF-8")}catch(i){}try{s.setRequestHeader("Accept","*/*")}catch(i){}(e=this._opts.cookieJar)===null||e===void 0||e.addCookies(s),"withCredentials"in s&&(s.withCredentials=this._opts.withCredentials),this._opts.requestTimeout&&(s.timeout=this._opts.requestTimeout),s.onreadystatechange=()=>{var i;s.readyState===3&&((i=this._opts.cookieJar)===null||i===void 0||i.parseCookies(s.getResponseHeader("set-cookie"))),s.readyState===4&&(s.status===200||s.status===1223?this._onLoad():this.setTimeoutFn(()=>{this._onError(typeof s.status=="number"?s.status:0)},0))},s.send(this._data)}catch(i){this.setTimeoutFn(()=>{this._onError(i)},0);return}typeof document!="undefined"&&(this._index=U.requestsCount++,U.requests[this._index]=this)}_onError(e){this.emitReserved("error",e,this._xhr),this._cleanup(!0)}_cleanup(e){if(!(typeof this._xhr=="undefined"||this._xhr===null)){if(this._xhr.onreadystatechange=ln,e)try{this._xhr.abort()}catch(t){}typeof document!="undefined"&&delete U.requests[this._index],this._xhr=null}}_onLoad(){const e=this._xhr.responseText;e!==null&&(this.emitReserved("data",e),this.emitReserved("success"),this._cleanup())}abort(){this._cleanup()}}if(U.requestsCount=0,U.requests={},typeof document!="undefined"){if(typeof attachEvent=="function")attachEvent("onunload",rt);else if(typeof addEventListener=="function"){const n="onpagehide"in C?"pagehide":"unload";addEventListener(n,rt,!1)}}function rt(){for(let n in U.requests)U.requests.hasOwnProperty(n)&&U.requests[n].abort()}const hn=(function(){const n=ot({xdomain:!1});return n&&n.responseType!==null})();class pn extends dn{constructor(e){super(e);const t=e&&e.forceBase64;this.supportsBinary=hn&&!t}request(e={}){return Object.assign(e,{xd:this.xd},this.opts),new U(ot,this.uri(),e)}}function ot(n){const e=n.xdomain;try{if(typeof XMLHttpRequest!="undefined"&&(!e||cn))return new XMLHttpRequest}catch(t){}if(!e)try{return new C[["Active"].concat("Object").join("X")]("Microsoft.XMLHTTP")}catch(t){}}const at=typeof navigator!="undefined"&&typeof navigator.product=="string"&&navigator.product.toLowerCase()==="reactnative";class un extends Ie{get name(){return"websocket"}doOpen(){const e=this.uri(),t=this.opts.protocols,s=at?{}:nt(this.opts,"agent","perMessageDeflate","pfx","key","passphrase","cert","ca","ciphers","rejectUnauthorized","localAddress","protocolVersion","origin","maxPayload","family","checkServerIdentity");this.opts.extraHeaders&&(s.headers=this.opts.extraHeaders);try{this.ws=this.createSocket(e,t,s)}catch(i){return this.emitReserved("error",i)}this.ws.binaryType=this.socket.binaryType,this.addEventListeners()}addEventListeners(){this.ws.onopen=()=>{this.opts.autoUnref&&this.ws._socket.unref(),this.onOpen()},this.ws.onclose=e=>this.onClose({description:"websocket connection closed",context:e}),this.ws.onmessage=e=>this.onData(e.data),this.ws.onerror=e=>this.onError("websocket error",e)}write(e){this.writable=!1;for(let t=0;t<e.length;t++){const s=e[t],i=t===e.length-1;Se(s,this.supportsBinary,r=>{try{this.doWrite(s,r)}catch(o){}i&&pe(()=>{this.writable=!0,this.emitReserved("drain")},this.setTimeoutFn)})}}doClose(){typeof this.ws!="undefined"&&(this.ws.onerror=()=>{},this.ws.close(),this.ws=null)}uri(){const e=this.opts.secure?"wss":"ws",t=this.query||{};return this.opts.timestampRequests&&(t[this.opts.timestampParam]=st()),this.supportsBinary||(t.b64=1),this.createUri(e,t)}}const Oe=C.WebSocket||C.MozWebSocket;class fn extends un{createSocket(e,t,s){return at?new Oe(e,t,s):t?new Oe(e,t):new Oe(e)}doWrite(e,t){this.ws.send(t)}}class mn extends Ie{get name(){return"webtransport"}doOpen(){try{this._transport=new WebTransport(this.createUri("https"),this.opts.transportOptions[this.name])}catch(e){return this.emitReserved("error",e)}this._transport.closed.then(()=>{this.onClose()}).catch(e=>{this.onError("webtransport error",e)}),this._transport.ready.then(()=>{this._transport.createBidirectionalStream().then(e=>{const t=Jt(Number.MAX_SAFE_INTEGER,this.socket.binaryType),s=e.readable.pipeThrough(t).getReader(),i=Wt();i.readable.pipeTo(e.writable),this._writer=i.writable.getWriter();const r=()=>{s.read().then(({done:l,value:a})=>{l||(this.onPacket(a),r())}).catch(l=>{})};r();const o={type:"open"};this.query.sid&&(o.data=`{"sid":"${this.query.sid}"}`),this._writer.write(o).then(()=>this.onOpen())})})}write(e){this.writable=!1;for(let t=0;t<e.length;t++){const s=e[t],i=t===e.length-1;this._writer.write(s).then(()=>{i&&pe(()=>{this.writable=!0,this.emitReserved("drain")},this.setTimeoutFn)})}}doClose(){var e;(e=this._transport)===null||e===void 0||e.close()}}const gn={websocket:fn,webtransport:mn,polling:pn},yn=/^(?:(?![^:@\/?#]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@\/?#]*)(?::([^:@\/?#]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/,bn=["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"];function Le(n){if(n.length>8e3)throw"URI too long";const e=n,t=n.indexOf("["),s=n.indexOf("]");t!=-1&&s!=-1&&(n=n.substring(0,t)+n.substring(t,s).replace(/:/g,";")+n.substring(s,n.length));let i=yn.exec(n||""),r={},o=14;for(;o--;)r[bn[o]]=i[o]||"";return t!=-1&&s!=-1&&(r.source=e,r.host=r.host.substring(1,r.host.length-1).replace(/;/g,":"),r.authority=r.authority.replace("[","").replace("]","").replace(/;/g,":"),r.ipv6uri=!0),r.pathNames=xn(r,r.path),r.queryKey=vn(r,r.query),r}function xn(n,e){const t=/\/{2,9}/g,s=e.replace(t,"/").split("/");return(e.slice(0,1)=="/"||e.length===0)&&s.splice(0,1),e.slice(-1)=="/"&&s.splice(s.length-1,1),s}function vn(n,e){const t={};return e.replace(/(?:^|&)([^&=]*)=?([^&]*)/g,function(s,i,r){i&&(t[i]=r)}),t}const Re=typeof addEventListener=="function"&&typeof removeEventListener=="function",fe=[];Re&&addEventListener("offline",()=>{fe.forEach(n=>n())},!1);class V extends S{constructor(e,t){if(super(),this.binaryType=Gt,this.writeBuffer=[],this._prevBufferLen=0,this._pingInterval=-1,this._pingTimeout=-1,this._maxPayload=-1,this._pingTimeoutTime=1/0,e&&typeof e=="object"&&(t=e,e=null),e){const s=Le(e);t.hostname=s.host,t.secure=s.protocol==="https"||s.protocol==="wss",t.port=s.port,s.query&&(t.query=s.query)}else t.host&&(t.hostname=Le(t.host).host);ue(this,t),this.secure=t.secure!=null?t.secure:typeof location!="undefined"&&location.protocol==="https:",t.hostname&&!t.port&&(t.port=this.secure?"443":"80"),this.hostname=t.hostname||(typeof location!="undefined"?location.hostname:"localhost"),this.port=t.port||(typeof location!="undefined"&&location.port?location.port:this.secure?"443":"80"),this.transports=[],this._transportsByName={},t.transports.forEach(s=>{const i=s.prototype.name;this.transports.push(i),this._transportsByName[i]=s}),this.opts=Object.assign({path:"/engine.io",agent:!1,withCredentials:!1,upgrade:!0,timestampParam:"t",rememberUpgrade:!1,addTrailingSlash:!0,rejectUnauthorized:!0,perMessageDeflate:{threshold:1024},transportOptions:{},closeOnBeforeunload:!1},t),this.opts.path=this.opts.path.replace(/\/$/,"")+(this.opts.addTrailingSlash?"/":""),typeof this.opts.query=="string"&&(this.opts.query=rn(this.opts.query)),Re&&(this.opts.closeOnBeforeunload&&(this._beforeunloadEventListener=()=>{this.transport&&(this.transport.removeAllListeners(),this.transport.close())},addEventListener("beforeunload",this._beforeunloadEventListener,!1)),this.hostname!=="localhost"&&(this._offlineEventListener=()=>{this._onClose("transport close",{description:"network connection lost"})},fe.push(this._offlineEventListener))),this.opts.withCredentials&&(this._cookieJar=void 0),this._open()}createTransport(e){const t=Object.assign({},this.opts.query);t.EIO=tt,t.transport=e,this.id&&(t.sid=this.id);const s=Object.assign({},this.opts,{query:t,socket:this,hostname:this.hostname,secure:this.secure,port:this.port},this.opts.transportOptions[e]);return new this._transportsByName[e](s)}_open(){if(this.transports.length===0){this.setTimeoutFn(()=>{this.emitReserved("error","No transports available")},0);return}const e=this.opts.rememberUpgrade&&V.priorWebsocketSuccess&&this.transports.indexOf("websocket")!==-1?"websocket":this.transports[0];this.readyState="opening";const t=this.createTransport(e);t.open(),this.setTransport(t)}setTransport(e){this.transport&&this.transport.removeAllListeners(),this.transport=e,e.on("drain",this._onDrain.bind(this)).on("packet",this._onPacket.bind(this)).on("error",this._onError.bind(this)).on("close",t=>this._onClose("transport close",t))}onOpen(){this.readyState="open",V.priorWebsocketSuccess=this.transport.name==="websocket",this.emitReserved("open"),this.flush()}_onPacket(e){if(this.readyState==="opening"||this.readyState==="open"||this.readyState==="closing")switch(this.emitReserved("packet",e),this.emitReserved("heartbeat"),e.type){case"open":this.onHandshake(JSON.parse(e.data));break;case"ping":this._sendPacket("pong"),this.emitReserved("ping"),this.emitReserved("pong"),this._resetPingTimeout();break;case"error":const t=new Error("server error");t.code=e.data,this._onError(t);break;case"message":this.emitReserved("data",e.data),this.emitReserved("message",e.data);break}}onHandshake(e){this.emitReserved("handshake",e),this.id=e.sid,this.transport.query.sid=e.sid,this._pingInterval=e.pingInterval,this._pingTimeout=e.pingTimeout,this._maxPayload=e.maxPayload,this.onOpen(),this.readyState!=="closed"&&this._resetPingTimeout()}_resetPingTimeout(){this.clearTimeoutFn(this._pingTimeoutTimer);const e=this._pingInterval+this._pingTimeout;this._pingTimeoutTime=Date.now()+e,this._pingTimeoutTimer=this.setTimeoutFn(()=>{this._onClose("ping timeout")},e),this.opts.autoUnref&&this._pingTimeoutTimer.unref()}_onDrain(){this.writeBuffer.splice(0,this._prevBufferLen),this._prevBufferLen=0,this.writeBuffer.length===0?this.emitReserved("drain"):this.flush()}flush(){if(this.readyState!=="closed"&&this.transport.writable&&!this.upgrading&&this.writeBuffer.length){const e=this._getWritablePackets();this.transport.send(e),this._prevBufferLen=e.length,this.emitReserved("flush")}}_getWritablePackets(){if(!(this._maxPayload&&this.transport.name==="polling"&&this.writeBuffer.length>1))return this.writeBuffer;let t=1;for(let s=0;s<this.writeBuffer.length;s++){const i=this.writeBuffer[s].data;if(i&&(t+=tn(i)),s>0&&t>this._maxPayload)return this.writeBuffer.slice(0,s);t+=2}return this.writeBuffer}_hasPingExpired(){if(!this._pingTimeoutTime)return!0;const e=Date.now()>this._pingTimeoutTime;return e&&(this._pingTimeoutTime=0,pe(()=>{this._onClose("ping timeout")},this.setTimeoutFn)),e}write(e,t,s){return this._sendPacket("message",e,t,s),this}send(e,t,s){return this._sendPacket("message",e,t,s),this}_sendPacket(e,t,s,i){if(typeof t=="function"&&(i=t,t=void 0),typeof s=="function"&&(i=s,s=null),this.readyState==="closing"||this.readyState==="closed")return;s=s||{},s.compress=s.compress!==!1;const r={type:e,data:t,options:s};this.emitReserved("packetCreate",r),this.writeBuffer.push(r),i&&this.once("flush",i),this.flush()}close(){const e=()=>{this._onClose("forced close"),this.transport.close()},t=()=>{this.off("upgrade",t),this.off("upgradeError",t),e()},s=()=>{this.once("upgrade",t),this.once("upgradeError",t)};return(this.readyState==="opening"||this.readyState==="open")&&(this.readyState="closing",this.writeBuffer.length?this.once("drain",()=>{this.upgrading?s():e()}):this.upgrading?s():e()),this}_onError(e){if(V.priorWebsocketSuccess=!1,this.opts.tryAllTransports&&this.transports.length>1&&this.readyState==="opening")return this.transports.shift(),this._open();this.emitReserved("error",e),this._onClose("transport error",e)}_onClose(e,t){if(this.readyState==="opening"||this.readyState==="open"||this.readyState==="closing"){if(this.clearTimeoutFn(this._pingTimeoutTimer),this.transport.removeAllListeners("close"),this.transport.close(),this.transport.removeAllListeners(),Re&&(this._beforeunloadEventListener&&removeEventListener("beforeunload",this._beforeunloadEventListener,!1),this._offlineEventListener)){const s=fe.indexOf(this._offlineEventListener);s!==-1&&fe.splice(s,1)}this.readyState="closed",this.id=null,this.emitReserved("close",e,t),this.writeBuffer=[],this._prevBufferLen=0}}}V.protocol=tt;class wn extends V{constructor(){super(...arguments),this._upgrades=[]}onOpen(){if(super.onOpen(),this.readyState==="open"&&this.opts.upgrade)for(let e=0;e<this._upgrades.length;e++)this._probe(this._upgrades[e])}_probe(e){let t=this.createTransport(e),s=!1;V.priorWebsocketSuccess=!1;const i=()=>{s||(t.send([{type:"ping",data:"probe"}]),t.once("packet",_=>{if(!s)if(_.type==="pong"&&_.data==="probe"){if(this.upgrading=!0,this.emitReserved("upgrading",t),!t)return;V.priorWebsocketSuccess=t.name==="websocket",this.transport.pause(()=>{s||this.readyState!=="closed"&&(m(),this.setTransport(t),t.send([{type:"upgrade"}]),this.emitReserved("upgrade",t),t=null,this.upgrading=!1,this.flush())})}else{const p=new Error("probe error");p.transport=t.name,this.emitReserved("upgradeError",p)}}))};function r(){s||(s=!0,m(),t.close(),t=null)}const o=_=>{const p=new Error("probe error: "+_);p.transport=t.name,r(),this.emitReserved("upgradeError",p)};function l(){o("transport closed")}function a(){o("socket closed")}function x(_){t&&_.name!==t.name&&r()}const m=()=>{t.removeListener("open",i),t.removeListener("error",o),t.removeListener("close",l),this.off("close",a),this.off("upgrading",x)};t.once("open",i),t.once("error",o),t.once("close",l),this.once("close",a),this.once("upgrading",x),this._upgrades.indexOf("webtransport")!==-1&&e!=="webtransport"?this.setTimeoutFn(()=>{s||t.open()},200):t.open()}onHandshake(e){this._upgrades=this._filterUpgrades(e.upgrades),super.onHandshake(e)}_filterUpgrades(e){const t=[];for(let s=0;s<e.length;s++)~this.transports.indexOf(e[s])&&t.push(e[s]);return t}}let _n=class extends wn{constructor(e,t={}){const s=typeof e=="object"?e:t;(!s.transports||s.transports&&typeof s.transports[0]=="string")&&(s.transports=(s.transports||["polling","websocket","webtransport"]).map(i=>gn[i]).filter(i=>!!i)),super(e,s)}};function kn(n,e="",t){let s=n;t=t||typeof location!="undefined"&&location,n==null&&(n=t.protocol+"//"+t.host),typeof n=="string"&&(n.charAt(0)==="/"&&(n.charAt(1)==="/"?n=t.protocol+n:n=t.host+n),/^(https?|wss?):\/\//.test(n)||(typeof t!="undefined"?n=t.protocol+"//"+n:n="https://"+n),s=Le(n)),s.port||(/^(http|ws)$/.test(s.protocol)?s.port="80":/^(http|ws)s$/.test(s.protocol)&&(s.port="443")),s.path=s.path||"/";const r=s.host.indexOf(":")!==-1?"["+s.host+"]":s.host;return s.id=s.protocol+"://"+r+":"+s.port+e,s.href=s.protocol+"://"+r+(t&&t.port===s.port?"":":"+s.port),s}const Sn=typeof ArrayBuffer=="function",En=n=>typeof ArrayBuffer.isView=="function"?ArrayBuffer.isView(n):n.buffer instanceof ArrayBuffer,ct=Object.prototype.toString,Tn=typeof Blob=="function"||typeof Blob!="undefined"&&ct.call(Blob)==="[object BlobConstructor]",An=typeof File=="function"||typeof File!="undefined"&&ct.call(File)==="[object FileConstructor]";function Be(n){return Sn&&(n instanceof ArrayBuffer||En(n))||Tn&&n instanceof Blob||An&&n instanceof File}function me(n,e){if(!n||typeof n!="object")return!1;if(Array.isArray(n)){for(let t=0,s=n.length;t<s;t++)if(me(n[t]))return!0;return!1}if(Be(n))return!0;if(n.toJSON&&typeof n.toJSON=="function"&&arguments.length===1)return me(n.toJSON(),!0);for(const t in n)if(Object.prototype.hasOwnProperty.call(n,t)&&me(n[t]))return!0;return!1}function In(n){const e=[],t=n.data,s=n;return s.data=Ce(t,e),s.attachments=e.length,{packet:s,buffers:e}}function Ce(n,e){if(!n)return n;if(Be(n)){const t={_placeholder:!0,num:e.length};return e.push(n),t}else if(Array.isArray(n)){const t=new Array(n.length);for(let s=0;s<n.length;s++)t[s]=Ce(n[s],e);return t}else if(typeof n=="object"&&!(n instanceof Date)){const t={};for(const s in n)Object.prototype.hasOwnProperty.call(n,s)&&(t[s]=Ce(n[s],e));return t}return n}function On(n,e){return n.data=$e(n.data,e),delete n.attachments,n}function $e(n,e){if(!n)return n;if(n&&n._placeholder===!0){if(typeof n.num=="number"&&n.num>=0&&n.num<e.length)return e[n.num];throw new Error("illegal attachments")}else if(Array.isArray(n))for(let t=0;t<n.length;t++)n[t]=$e(n[t],e);else if(typeof n=="object")for(const t in n)Object.prototype.hasOwnProperty.call(n,t)&&(n[t]=$e(n[t],e));return n}const Ln=["connect","connect_error","disconnect","disconnecting","newListener","removeListener"];var v;(function(n){n[n.CONNECT=0]="CONNECT",n[n.DISCONNECT=1]="DISCONNECT",n[n.EVENT=2]="EVENT",n[n.ACK=3]="ACK",n[n.CONNECT_ERROR=4]="CONNECT_ERROR",n[n.BINARY_EVENT=5]="BINARY_EVENT",n[n.BINARY_ACK=6]="BINARY_ACK"})(v||(v={}));class Rn{constructor(e){this.replacer=e}encode(e){return(e.type===v.EVENT||e.type===v.ACK)&&me(e)?this.encodeAsBinary({type:e.type===v.EVENT?v.BINARY_EVENT:v.BINARY_ACK,nsp:e.nsp,data:e.data,id:e.id}):[this.encodeAsString(e)]}encodeAsString(e){let t=""+e.type;return(e.type===v.BINARY_EVENT||e.type===v.BINARY_ACK)&&(t+=e.attachments+"-"),e.nsp&&e.nsp!=="/"&&(t+=e.nsp+","),e.id!=null&&(t+=e.id),e.data!=null&&(t+=JSON.stringify(e.data,this.replacer)),t}encodeAsBinary(e){const t=In(e),s=this.encodeAsString(t.packet),i=t.buffers;return i.unshift(s),i}}class Ne extends S{constructor(e){super(),this.opts=Object.assign({reviver:void 0,maxAttachments:10},typeof e=="function"?{reviver:e}:e)}add(e){let t;if(typeof e=="string"){if(this.reconstructor)throw new Error("got plaintext data when reconstructing a packet");t=this.decodeString(e);const s=t.type===v.BINARY_EVENT;s||t.type===v.BINARY_ACK?(t.type=s?v.EVENT:v.ACK,this.reconstructor=new Bn(t),t.attachments===0&&super.emitReserved("decoded",t)):super.emitReserved("decoded",t)}else if(Be(e)||e.base64)if(this.reconstructor)t=this.reconstructor.takeBinaryData(e),t&&(this.reconstructor=null,super.emitReserved("decoded",t));else throw new Error("got binary data when not reconstructing a packet");else throw new Error("Unknown type: "+e)}decodeString(e){let t=0;const s={type:Number(e.charAt(0))};if(v[s.type]===void 0)throw new Error("unknown packet type "+s.type);if(s.type===v.BINARY_EVENT||s.type===v.BINARY_ACK){const r=t+1;for(;e.charAt(++t)!=="-"&&t!=e.length;);const o=e.substring(r,t);if(o!=Number(o)||e.charAt(t)!=="-")throw new Error("Illegal attachments");const l=Number(o);if(!Cn(l)||l<0)throw new Error("Illegal attachments");if(l>this.opts.maxAttachments)throw new Error("too many attachments");s.attachments=l}if(e.charAt(t+1)==="/"){const r=t+1;for(;++t&&!(e.charAt(t)===","||t===e.length););s.nsp=e.substring(r,t)}else s.nsp="/";const i=e.charAt(t+1);if(i!==""&&Number(i)==i){const r=t+1;for(;++t;){const o=e.charAt(t);if(o==null||Number(o)!=o){--t;break}if(t===e.length)break}s.id=Number(e.substring(r,t+1))}if(e.charAt(++t)){const r=this.tryParse(e.substr(t));if(Ne.isPayloadValid(s.type,r))s.data=r;else throw new Error("invalid payload")}return s}tryParse(e){try{return JSON.parse(e,this.opts.reviver)}catch(t){return!1}}static isPayloadValid(e,t){switch(e){case v.CONNECT:return lt(t);case v.DISCONNECT:return t===void 0;case v.CONNECT_ERROR:return typeof t=="string"||lt(t);case v.EVENT:case v.BINARY_EVENT:return Array.isArray(t)&&(typeof t[0]=="number"||typeof t[0]=="string"&&Ln.indexOf(t[0])===-1);case v.ACK:case v.BINARY_ACK:return Array.isArray(t)}}destroy(){this.reconstructor&&(this.reconstructor.finishedReconstruction(),this.reconstructor=null)}}class Bn{constructor(e){this.packet=e,this.buffers=[],this.reconPack=e}takeBinaryData(e){if(this.buffers.push(e),this.buffers.length===this.reconPack.attachments){const t=On(this.reconPack,this.buffers);return this.finishedReconstruction(),t}return null}finishedReconstruction(){this.reconPack=null,this.buffers=[]}}const Cn=Number.isInteger||function(n){return typeof n=="number"&&isFinite(n)&&Math.floor(n)===n};function lt(n){return Object.prototype.toString.call(n)==="[object Object]"}const $n=Object.freeze(Object.defineProperty({__proto__:null,Decoder:Ne,Encoder:Rn,get PacketType(){return v}},Symbol.toStringTag,{value:"Module"}));function D(n,e,t){return n.on(e,t),function(){n.off(e,t)}}const Nn=Object.freeze({connect:1,connect_error:1,disconnect:1,disconnecting:1,newListener:1,removeListener:1});class dt extends S{constructor(e,t,s){super(),this.connected=!1,this.recovered=!1,this.receiveBuffer=[],this.sendBuffer=[],this._queue=[],this._queueSeq=0,this.ids=0,this.acks={},this.flags={},this.io=e,this.nsp=t,s&&s.auth&&(this.auth=s.auth),this._opts=Object.assign({},s),this.io._autoConnect&&this.open()}get disconnected(){return!this.connected}subEvents(){if(this.subs)return;const e=this.io;this.subs=[D(e,"open",this.onopen.bind(this)),D(e,"packet",this.onpacket.bind(this)),D(e,"error",this.onerror.bind(this)),D(e,"close",this.onclose.bind(this))]}get active(){return!!this.subs}connect(){return this.connected?this:(this.subEvents(),this.io._reconnecting||this.io.open(),this.io._readyState==="open"&&this.onopen(),this)}open(){return this.connect()}send(...e){return e.unshift("message"),this.emit.apply(this,e),this}emit(e,...t){var s,i,r;if(Nn.hasOwnProperty(e))throw new Error('"'+e.toString()+'" is a reserved event name');if(t.unshift(e),this._opts.retries&&!this.flags.fromQueue&&!this.flags.volatile)return this._addToQueue(t),this;const o={type:v.EVENT,data:t};if(o.options={},o.options.compress=this.flags.compress!==!1,typeof t[t.length-1]=="function"){const m=this.ids++,_=t.pop();this._registerAckCallback(m,_),o.id=m}const l=(i=(s=this.io.engine)===null||s===void 0?void 0:s.transport)===null||i===void 0?void 0:i.writable,a=this.connected&&!(!((r=this.io.engine)===null||r===void 0)&&r._hasPingExpired());return this.flags.volatile&&!l||(a?(this.notifyOutgoingListeners(o),this.packet(o)):this.sendBuffer.push(o)),this.flags={},this}_registerAckCallback(e,t){var s;const i=(s=this.flags.timeout)!==null&&s!==void 0?s:this._opts.ackTimeout;if(i===void 0){this.acks[e]=t;return}const r=this.io.setTimeoutFn(()=>{delete this.acks[e];for(let l=0;l<this.sendBuffer.length;l++)this.sendBuffer[l].id===e&&this.sendBuffer.splice(l,1);t.call(this,new Error("operation has timed out"))},i),o=(...l)=>{this.io.clearTimeoutFn(r),t.apply(this,l)};o.withError=!0,this.acks[e]=o}emitWithAck(e,...t){return new Promise((s,i)=>{const r=(o,l)=>o?i(o):s(l);r.withError=!0,t.push(r),this.emit(e,...t)})}_addToQueue(e){let t;typeof e[e.length-1]=="function"&&(t=e.pop());const s={id:this._queueSeq++,tryCount:0,pending:!1,args:e,flags:Object.assign({fromQueue:!0},this.flags)};e.push((i,...r)=>(this._queue[0],i!==null?s.tryCount>this._opts.retries&&(this._queue.shift(),t&&t(i)):(this._queue.shift(),t&&t(null,...r)),s.pending=!1,this._drainQueue())),this._queue.push(s),this._drainQueue()}_drainQueue(e=!1){if(!this.connected||this._queue.length===0)return;const t=this._queue[0];t.pending&&!e||(t.pending=!0,t.tryCount++,this.flags=t.flags,this.emit.apply(this,t.args))}packet(e){e.nsp=this.nsp,this.io._packet(e)}onopen(){typeof this.auth=="function"?this.auth(e=>{this._sendConnectPacket(e)}):this._sendConnectPacket(this.auth)}_sendConnectPacket(e){this.packet({type:v.CONNECT,data:this._pid?Object.assign({pid:this._pid,offset:this._lastOffset},e):e})}onerror(e){this.connected||this.emitReserved("connect_error",e)}onclose(e,t){this.connected=!1,delete this.id,this.emitReserved("disconnect",e,t),this._clearAcks()}_clearAcks(){Object.keys(this.acks).forEach(e=>{if(!this.sendBuffer.some(s=>String(s.id)===e)){const s=this.acks[e];delete this.acks[e],s.withError&&s.call(this,new Error("socket has been disconnected"))}})}onpacket(e){if(e.nsp===this.nsp)switch(e.type){case v.CONNECT:e.data&&e.data.sid?this.onconnect(e.data.sid,e.data.pid):this.emitReserved("connect_error",new Error("It seems you are trying to reach a Socket.IO server in v2.x with a v3.x client, but they are not compatible (more information here: https://socket.io/docs/v3/migrating-from-2-x-to-3-0/)"));break;case v.EVENT:case v.BINARY_EVENT:this.onevent(e);break;case v.ACK:case v.BINARY_ACK:this.onack(e);break;case v.DISCONNECT:this.ondisconnect();break;case v.CONNECT_ERROR:this.destroy();const s=new Error(e.data.message);s.data=e.data.data,this.emitReserved("connect_error",s);break}}onevent(e){const t=e.data||[];e.id!=null&&t.push(this.ack(e.id)),this.connected?this.emitEvent(t):this.receiveBuffer.push(Object.freeze(t))}emitEvent(e){if(this._anyListeners&&this._anyListeners.length){const t=this._anyListeners.slice();for(const s of t)s.apply(this,e)}super.emit.apply(this,e),this._pid&&e.length&&typeof e[e.length-1]=="string"&&(this._lastOffset=e[e.length-1])}ack(e){const t=this;let s=!1;return function(...i){s||(s=!0,t.packet({type:v.ACK,id:e,data:i}))}}onack(e){const t=this.acks[e.id];typeof t=="function"&&(delete this.acks[e.id],t.withError&&e.data.unshift(null),t.apply(this,e.data))}onconnect(e,t){this.id=e,this.recovered=t&&this._pid===t,this._pid=t,this.connected=!0,this.emitBuffered(),this._drainQueue(!0),this.emitReserved("connect")}emitBuffered(){this.receiveBuffer.forEach(e=>this.emitEvent(e)),this.receiveBuffer=[],this.sendBuffer.forEach(e=>{this.notifyOutgoingListeners(e),this.packet(e)}),this.sendBuffer=[]}ondisconnect(){this.destroy(),this.onclose("io server disconnect")}destroy(){this.subs&&(this.subs.forEach(e=>e()),this.subs=void 0),this.io._destroy(this)}disconnect(){return this.connected&&this.packet({type:v.DISCONNECT}),this.destroy(),this.connected&&this.onclose("io client disconnect"),this}close(){return this.disconnect()}compress(e){return this.flags.compress=e,this}get volatile(){return this.flags.volatile=!0,this}timeout(e){return this.flags.timeout=e,this}onAny(e){return this._anyListeners=this._anyListeners||[],this._anyListeners.push(e),this}prependAny(e){return this._anyListeners=this._anyListeners||[],this._anyListeners.unshift(e),this}offAny(e){if(!this._anyListeners)return this;if(e){const t=this._anyListeners;for(let s=0;s<t.length;s++)if(e===t[s])return t.splice(s,1),this}else this._anyListeners=[];return this}listenersAny(){return this._anyListeners||[]}onAnyOutgoing(e){return this._anyOutgoingListeners=this._anyOutgoingListeners||[],this._anyOutgoingListeners.push(e),this}prependAnyOutgoing(e){return this._anyOutgoingListeners=this._anyOutgoingListeners||[],this._anyOutgoingListeners.unshift(e),this}offAnyOutgoing(e){if(!this._anyOutgoingListeners)return this;if(e){const t=this._anyOutgoingListeners;for(let s=0;s<t.length;s++)if(e===t[s])return t.splice(s,1),this}else this._anyOutgoingListeners=[];return this}listenersAnyOutgoing(){return this._anyOutgoingListeners||[]}notifyOutgoingListeners(e){if(this._anyOutgoingListeners&&this._anyOutgoingListeners.length){const t=this._anyOutgoingListeners.slice();for(const s of t)s.apply(this,e.data)}}}function Q(n){n=n||{},this.ms=n.min||100,this.max=n.max||1e4,this.factor=n.factor||2,this.jitter=n.jitter>0&&n.jitter<=1?n.jitter:0,this.attempts=0}Q.prototype.duration=function(){var n=this.ms*Math.pow(this.factor,this.attempts++);if(this.jitter){var e=Math.random(),t=Math.floor(e*this.jitter*n);n=(Math.floor(e*10)&1)==0?n-t:n+t}return Math.min(n,this.max)|0},Q.prototype.reset=function(){this.attempts=0},Q.prototype.setMin=function(n){this.ms=n},Q.prototype.setMax=function(n){this.max=n},Q.prototype.setJitter=function(n){this.jitter=n};class qe extends S{constructor(e,t){var s;super(),this.nsps={},this.subs=[],e&&typeof e=="object"&&(t=e,e=void 0),t=t||{},t.path=t.path||"/socket.io",this.opts=t,ue(this,t),this.reconnection(t.reconnection!==!1),this.reconnectionAttempts(t.reconnectionAttempts||1/0),this.reconnectionDelay(t.reconnectionDelay||1e3),this.reconnectionDelayMax(t.reconnectionDelayMax||5e3),this.randomizationFactor((s=t.randomizationFactor)!==null&&s!==void 0?s:.5),this.backoff=new Q({min:this.reconnectionDelay(),max:this.reconnectionDelayMax(),jitter:this.randomizationFactor()}),this.timeout(t.timeout==null?2e4:t.timeout),this._readyState="closed",this.uri=e;const i=t.parser||$n;this.encoder=new i.Encoder,this.decoder=new i.Decoder,this._autoConnect=t.autoConnect!==!1,this._autoConnect&&this.open()}reconnection(e){return arguments.length?(this._reconnection=!!e,e||(this.skipReconnect=!0),this):this._reconnection}reconnectionAttempts(e){return e===void 0?this._reconnectionAttempts:(this._reconnectionAttempts=e,this)}reconnectionDelay(e){var t;return e===void 0?this._reconnectionDelay:(this._reconnectionDelay=e,(t=this.backoff)===null||t===void 0||t.setMin(e),this)}randomizationFactor(e){var t;return e===void 0?this._randomizationFactor:(this._randomizationFactor=e,(t=this.backoff)===null||t===void 0||t.setJitter(e),this)}reconnectionDelayMax(e){var t;return e===void 0?this._reconnectionDelayMax:(this._reconnectionDelayMax=e,(t=this.backoff)===null||t===void 0||t.setMax(e),this)}timeout(e){return arguments.length?(this._timeout=e,this):this._timeout}maybeReconnectOnOpen(){!this._reconnecting&&this._reconnection&&this.backoff.attempts===0&&this.reconnect()}open(e){if(~this._readyState.indexOf("open"))return this;this.engine=new _n(this.uri,this.opts);const t=this.engine,s=this;this._readyState="opening",this.skipReconnect=!1;const i=D(t,"open",function(){s.onopen(),e&&e()}),r=l=>{this.cleanup(),this._readyState="closed",this.emitReserved("error",l),e?e(l):this.maybeReconnectOnOpen()},o=D(t,"error",r);if(this._timeout!==!1){const l=this._timeout,a=this.setTimeoutFn(()=>{i(),r(new Error("timeout")),t.close()},l);this.opts.autoUnref&&a.unref(),this.subs.push(()=>{this.clearTimeoutFn(a)})}return this.subs.push(i),this.subs.push(o),this}connect(e){return this.open(e)}onopen(){this.cleanup(),this._readyState="open",this.emitReserved("open");const e=this.engine;this.subs.push(D(e,"ping",this.onping.bind(this)),D(e,"data",this.ondata.bind(this)),D(e,"error",this.onerror.bind(this)),D(e,"close",this.onclose.bind(this)),D(this.decoder,"decoded",this.ondecoded.bind(this)))}onping(){this.emitReserved("ping")}ondata(e){try{this.decoder.add(e)}catch(t){this.onclose("parse error",t)}}ondecoded(e){pe(()=>{this.emitReserved("packet",e)},this.setTimeoutFn)}onerror(e){this.emitReserved("error",e)}socket(e,t){let s=this.nsps[e];return s?this._autoConnect&&!s.active&&s.connect():(s=new dt(this,e,t),this.nsps[e]=s),s}_destroy(e){const t=Object.keys(this.nsps);for(const s of t)if(this.nsps[s].active)return;this._close()}_packet(e){const t=this.encoder.encode(e);for(let s=0;s<t.length;s++)this.engine.write(t[s],e.options)}cleanup(){this.subs.forEach(e=>e()),this.subs.length=0,this.decoder.destroy()}_close(){this.skipReconnect=!0,this._reconnecting=!1,this.onclose("forced close")}disconnect(){return this._close()}onclose(e,t){var s;this.cleanup(),(s=this.engine)===null||s===void 0||s.close(),this.backoff.reset(),this._readyState="closed",this.emitReserved("close",e,t),this._reconnection&&!this.skipReconnect&&this.reconnect()}reconnect(){if(this._reconnecting||this.skipReconnect)return this;const e=this;if(this.backoff.attempts>=this._reconnectionAttempts)this.backoff.reset(),this.emitReserved("reconnect_failed"),this._reconnecting=!1;else{const t=this.backoff.duration();this._reconnecting=!0;const s=this.setTimeoutFn(()=>{e.skipReconnect||(this.emitReserved("reconnect_attempt",e.backoff.attempts),!e.skipReconnect&&e.open(i=>{i?(e._reconnecting=!1,e.reconnect(),this.emitReserved("reconnect_error",i)):e.onreconnect()}))},t);this.opts.autoUnref&&s.unref(),this.subs.push(()=>{this.clearTimeoutFn(s)})}}onreconnect(){const e=this.backoff.attempts;this._reconnecting=!1,this.backoff.reset(),this.emitReserved("reconnect",e)}}const se={};function ge(n,e){typeof n=="object"&&(e=n,n=void 0),e=e||{};const t=kn(n,e.path||"/socket.io"),s=t.source,i=t.id,r=t.path,o=se[i]&&r in se[i].nsps,l=e.forceNew||e["force new connection"]||e.multiplex===!1||o;let a;return l?a=new qe(s,e):(se[i]||(se[i]=new qe(s,e)),a=se[i]),t.query&&!e.query&&(e.query=t.queryKey),a.socket(t.path,e)}Object.assign(ge,{Manager:qe,Socket:dt,io:ge,connect:ge});function qn(n,e,t){const s=n.apiBase||window.location.origin,i=ge(s,{path:"/livechat-ws",auth:{siteKey:n.siteKey,visitorId:n.visitorId,sessionId:e},transports:["websocket","polling"],reconnection:!0,reconnectionDelay:600,reconnectionDelayMax:8e3});return i.on("livechat:event",r=>{r.sessionId===e&&t(r)}),i}const Mn=`
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

/* Higher specificity than the global .lc-composer button rule below — the
   picker button + tabs + grid items live inside .lc-composer so without
   this they'd inherit the brand-blue circle styling. */
.lc-composer .lc-emoji-btn {
  background: transparent;
  border: 0;
  color: #6b7280;
  cursor: pointer;
  padding: 6px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
}
.lc-composer .lc-emoji-btn:hover { background: #f3f4f6; color: #111827; }
.lc-composer .lc-emoji-btn svg { width: 18px; height: 18px; }

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
.lc-composer .lc-emoji-tab {
  background: transparent;
  border: 0;
  padding: 8px 10px;
  width: auto;
  height: auto;
  border-radius: 0;
  font-size: 11px;
  color: #6b7280;
  cursor: pointer;
  white-space: nowrap;
  border-bottom: 2px solid transparent;
}
.lc-composer .lc-emoji-tab:hover { color: #111827; background: transparent; }
.lc-composer .lc-emoji-tab-active { color: #111827; border-bottom-color: var(--lc-brand, #2563eb); font-weight: 600; }
.lc-emoji-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 2px;
  padding: 8px;
  max-height: 220px;
  overflow-y: auto;
}
.lc-composer .lc-emoji-pick {
  background: transparent;
  border: 0;
  padding: 4px;
  width: auto;
  height: 32px;
  font-size: 20px;
  cursor: pointer;
  border-radius: 6px;
  line-height: 1;
  color: inherit;
}
.lc-composer .lc-emoji-pick:hover { background: #f3f4f6; }

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

/* ── Inline identify (rendered as an agent bubble) ── */
.lc-inline-identify {
  padding: 10px 12px !important;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 220px;
}
.lc-inline-prompt { font-size: 13px; line-height: 1.4; color: #1f2937; }
.lc-inline-greet { color: var(--lc-brand, #2563eb); font-weight: 600; }
.lc-inline-row { display: flex; gap: 6px; align-items: stretch; }
.lc-inline-input {
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 13px;
  font: inherit;
  background: #fff;
  outline: none;
  transition: border-color 0.15s;
}
.lc-inline-input:focus { border-color: var(--lc-brand, #2563eb); }
.lc-inline-input--invalid { border-color: #ef4444 !important; background: #fef2f2 !important; }
.lc-inline-save {
  background: var(--lc-brand, #2563eb);
  border: 0;
  color: #fff;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  flex-shrink: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.15s;
}
.lc-inline-save:hover { opacity: 0.9; }
.lc-inline-save svg { width: 14px; height: 14px; }
.lc-inline-skip {
  align-self: flex-start;
  background: transparent;
  border: 0;
  color: #9ca3af;
  font-size: 11px;
  padding: 0;
  cursor: pointer;
  font: inherit;
}
.lc-inline-skip:hover { color: #6b7280; }
.lc-inline-error {
  font-size: 11px;
  color: #ef4444;
  margin-top: -4px;
}

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
`,Me=[{name:"Smileys",emojis:["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","😐","😑","😶","🙄","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🤐","🤨","😐","😑","😶","😏","😴","🤤","😪","😵","🤐","🥴","🤢","🤮","🤧","😷"]},{name:"Hearts",emojis:["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟"]},{name:"Hands",emojis:["👍","👎","👌","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","👋","🤚","🖐️","✋","🖖","👏","🙌","🤝","🙏","✍️","💪","🦾"]},{name:"Objects",emojis:["🔥","✨","🎉","🎊","🎁","🏆","🥇","⭐","🌟","💫","💥","💯","✅","❌","⚠️","❓","❗","💡","📌","📎","🔗","🔒","🔑","⏰","⏳","📅","📆","🗓️","📊","📈"]},{name:"Travel",emojis:["🚀","✈️","🚗","🚕","🚙","🚌","🏠","🏢","🏥","🏦","🏪","🏫","⛺","🌍","🌎","🌏","🗺️","🏖️","🏔️","🌋"]}],Dn=[[":)","🙂"],[":-)","🙂"],[":D","😄"],[":-D","😄"],["xD","😆"],["XD","😆"],[":P","😛"],[":p","😋"],[":-P","😛"],[":'(","😢"],[":(","🙁"],[":-(","🙁"],[";)","😉"],[";-)","😉"],[":O","😮"],[":o","😮"],[":-O","😮"],[":oO","😳"],[":|","😐"],[":-|","😐"],[":/","😕"],[":-/","😕"],["<3","❤️"],["</3","💔"],[":*","😘"],["B)","😎"]];function Pn(n){let e=n;for(const[t,s]of Dn){const i=t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),r=new RegExp(`(^|\\s)${i}(?=\\s|$|[.,!?])`,"g");e=e.replace(r,`$1${s}`)}return e}const jn="https://gist.githubusercontent.com/Sharifur/b40c7b54b97d43f353f1382e51c70535/raw/f6446fa378bf266cacf604f1e97f8f318e01e157/temporary-email-address-domain-list.json",ht="livechat_disposable_domains",pt="livechat_disposable_domains_ts",zn=1440*60*1e3;let Y=null;async function ut(){if(Y)return Y;try{const n=localStorage.getItem(pt),e=localStorage.getItem(ht),t=n?Number(n):0;if(e&&t&&Date.now()-t<zn){const s=JSON.parse(e);return Y=new Set(s.map(i=>i.toLowerCase())),Y}}catch(n){}try{const n=new AbortController,e=setTimeout(()=>n.abort(),4e3),t=await fetch(jn,{signal:n.signal});if(clearTimeout(e),t.ok){const s=await t.json(),r=(Array.isArray(s)?s:[]).map(o=>String(o).trim().toLowerCase()).filter(Boolean);Y=new Set(r);try{localStorage.setItem(ht,JSON.stringify(r)),localStorage.setItem(pt,String(Date.now()))}catch(o){}return Y}}catch(n){}return Y=new Set(["mailinator.com","guerrillamail.com","10minutemail.com","tempmail.com","temp-mail.org","yopmail.com","trashmail.com","fakeinbox.com","throwawaymail.com","getairmail.com","sharklasers.com"]),Y}async function Un(n){const e=n.lastIndexOf("@");if(e<0)return!1;const t=n.slice(e+1).trim().toLowerCase();return t?(await ut()).has(t):!1}function Hn(){ut()}const Fn={siteKey:"",botName:"Hi there",botSubtitle:"We typically reply in a few seconds.",welcomeMessage:null,brandColor:"#2563eb",position:"bottom-right"},De="livechat_messages_cache",Pe="livechat_session_id",je="livechat_identify_dismissed",ye="livechat_identify_name",ze="livechat_identify_email",ft="livechat_send_log",be="livechat_proactive_seen",Kn=30,Vn=6e4,Yn=3;function Wn(n,e=Fn){var q,f;const t=document.createElement("div");t.id="livechat-widget-root",t.style.cssText="position: fixed; bottom: 40px; right: 40px; z-index: 2147483646;",document.body.appendChild(t);const s=t.attachShadow({mode:"open"}),i=(q=is(e.brandColor))!=null?q:"#2563eb",r=vt(i,.35),o=vt(i,.45);t.style.setProperty("--lc-brand",i),t.style.setProperty("--lc-brand-shadow",r),t.style.setProperty("--lc-brand-shadow-hover",o),e.position==="bottom-left"&&t.classList.add("lc-position-left");const l=document.createElement("style");l.textContent=Mn,s.appendChild(l);const a={open:!1,sessionId:ts(),messages:ss(),socket:null,panel:null,askedForEmail:!1,askedForName:!1,knownName:Qn(),unread:0,sessionClosed:!1,feedbackAsked:!1,operators:(f=e.operators)!=null?f:[],host:t,cfg:n},x=document.createElement("button");x.className="lc-bubble",x.innerHTML=ps(),s.appendChild(x);const m=document.createElement("span");m.className="lc-unread",m.style.display="none",x.appendChild(m);const _=document.createElement("div");if(_.className="lc-proactive",_.style.display="none",e.welcomeMessage){_.innerHTML=`
      <button class="lc-proactive-close" aria-label="Dismiss">&#x2715;</button>
      <div class="lc-proactive-text">${E(e.welcomeMessage)}</div>
    `,s.appendChild(_);let w=!1;try{w=!!sessionStorage.getItem(be)}catch(W){}w||setTimeout(()=>{a.open||(_.style.display="block")},1500),_.querySelector(".lc-proactive-close").addEventListener("click",W=>{W.stopPropagation(),_.style.display="none";try{sessionStorage.setItem(be,"1")}catch(oe){}}),_.querySelector(".lc-proactive-text").addEventListener("click",()=>{_.style.display="none";try{sessionStorage.setItem(be,"1")}catch(W){}x.click()})}a.messages.length===0&&e.welcomeMessage&&(a.messages.push({id:"welcome",role:"agent",content:e.welcomeMessage,createdAt:new Date().toISOString()}),Z(a.messages));const p=Jn(s,n,a,j,e);p.style.display="none",a.panel=p,p._state=a,p._cfg=n;const I=()=>window.innerWidth<=480,N="position: fixed; bottom: 40px; right: 40px; z-index: 2147483646;";function h(){const w=window.visualViewport;w?t.style.cssText=`position: fixed; top: ${w.offsetTop}px; left: ${w.offsetLeft}px; width: ${w.width}px; height: ${w.height}px; z-index: 2147483646;`:t.style.cssText="position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 2147483646;"}let B=!1;function H(){if(B||!window.visualViewport)return;B=!0;const w=()=>{a.open&&(I()?h():t.style.cssText=N)};window.visualViewport.addEventListener("resize",w),window.visualViewport.addEventListener("scroll",w)}x.addEventListener("click",()=>{_.style.display="none";try{sessionStorage.setItem(be,"1")}catch(w){}if(a.open=!a.open,a.open){I()&&(h(),H()),p.classList.remove("lc-panel--closing"),p.style.display="flex",a.unread=0,m.style.display="none";const w=p.querySelector("textarea");w==null||w.focus(),gt(p)}else p.classList.add("lc-panel--closing"),setTimeout(()=>{a.open||(p.style.display="none",I()&&(t.style.cssText=N)),p.classList.remove("lc-panel--closing")},180)}),a.sessionId&&mt(n,a,j,e),Hn();function j(){Xn(p,a),!a.open&&a.unread>0?(m.textContent=String(Math.min(a.unread,99)),m.style.display="flex"):m.style.display="none"}j()}function Jn(n,e,t,s,i){var Nt;const r=document.createElement("div");r.className="lc-panel",r.innerHTML=`
    <div class="lc-header">
      <div class="lc-header-inner">
        ${xs((Nt=i.operators)!=null?Nt:[],i.operatorName)}
        <div class="lc-header-text">
          <div class="lc-header-title">${E(i.operatorName||i.botName)}</div>
          <div class="lc-header-sub"><span class="lc-online-dot"></span>${E(i.botSubtitle)}</div>
        </div>
      </div>
      <div class="lc-header-actions">
        <button class="lc-newchat-btn" aria-label="Start new conversation">${bs()}</button>
        <button class="lc-menu-btn" aria-label="Conversation menu" aria-haspopup="true">${fs()}</button>
        <div class="lc-menu" role="menu" style="display:none;">
          <button class="lc-menu-item" data-action="new">${ms()} Start a new conversation</button>
          <button class="lc-menu-item" data-action="close">${gs()} End this chat</button>
        </div>
        <button class="lc-close" aria-label="Close">${wt()}</button>
      </div>
    </div>
    <div class="lc-messages-wrap">
      <div class="lc-messages"></div>
      <button class="lc-scroll-btn" type="button" style="display:none;" aria-label="Scroll to latest">${wt()} New messages</button>
    </div>
    <div class="lc-quick-replies" style="display:none;"></div>
    <div class="lc-toast" role="alert" style="display:none;"></div>
    <div class="lc-pending" style="display:none;"></div>
    <div class="lc-session-end" style="display:none;">
      <span>This conversation has ended.</span>
      <button type="button" class="lc-session-end-btn">Start new chat</button>
    </div>
    <form class="lc-composer" autocomplete="off">
      <input class="lc-hp" name="website" tabindex="-1" autocomplete="off" />
      <input class="lc-file-input" type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" style="display:none;" />
      <button type="button" class="lc-attach-btn" aria-label="Attach file">${ds()}</button>
      <button type="button" class="lc-emoji-btn" aria-label="Insert emoji">${ys()}</button>
      <div class="lc-emoji-pop" style="display:none;" role="dialog" aria-label="Emoji picker">
        <div class="lc-emoji-tabs">${Me.map((c,d)=>`<button type="button" class="lc-emoji-tab${d===0?" lc-emoji-tab-active":""}" data-cat="${d}">${c.name}</button>`).join("")}</div>
        <div class="lc-emoji-grid">${Me[0].emojis.map(c=>`<button type="button" class="lc-emoji-pick" data-emoji="${c}">${c}</button>`).join("")}</div>
      </div>
      <textarea placeholder="Type your message…" rows="1"></textarea>
      <button type="submit" aria-label="Send">${_t()}</button>
    </form>
  `,n.appendChild(r);const o="position: fixed; bottom: 40px; right: 40px; z-index: 2147483646;";r.querySelector(".lc-newchat-btn").addEventListener("click",()=>{confirm("Start a new conversation? The current chat will be cleared.")&&we()}),r.querySelector(".lc-close").addEventListener("click",()=>{t.open=!1,r.classList.add("lc-panel--closing"),setTimeout(()=>{t.open||(r.style.display="none",window.innerWidth<=480&&(t.host.style.cssText=o)),r.classList.remove("lc-panel--closing")},180)});const x=r.querySelector(".lc-menu-btn"),m=r.querySelector(".lc-menu"),_=()=>{m.style.display="none"};x.addEventListener("click",c=>{c.stopPropagation(),m.style.display=m.style.display==="none"?"block":"none"}),r.addEventListener("click",c=>{!m.contains(c.target)&&c.target!==x&&_()}),m.addEventListener("click",async c=>{const d=c.target.closest(".lc-menu-item");if(!d)return;_();const u=d.getAttribute("data-action");if(u==="new"){if(!confirm("Start a new conversation? The current chat will be cleared."))return;we()}else if(u==="close"){if(!confirm("End this chat? You can always start a new one."))return;const y=t.sessionId;if(y)try{await fetch(`${e.apiBase}/livechat/session/${encodeURIComponent(y)}/close`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({siteKey:e.siteKey,visitorId:e.visitorId}),credentials:"omit"})}catch(g){}we(),t.messages=[{id:`system-${Date.now()}`,role:"system",content:"Chat ended. Type a message to start a new conversation.",createdAt:new Date().toISOString()}],Z(t.messages),s()}});const p=r.querySelector(".lc-messages"),I=r.querySelector(".lc-scroll-btn");p.addEventListener("scroll",()=>{const c=p.scrollHeight-p.scrollTop-p.clientHeight;I.style.display=c>120?"flex":"none"}),I.addEventListener("click",()=>{p.scrollTop=p.scrollHeight,I.style.display="none"});const N=r.querySelector(".lc-composer"),h=r.querySelector("textarea"),B=r.querySelector(".lc-hp"),H=r.querySelector('.lc-composer button[type="submit"]'),j=r.querySelector(".lc-attach-btn"),q=r.querySelector(".lc-file-input"),f=r.querySelector(".lc-pending"),w=r.querySelector(".lc-quick-replies"),W=r.querySelector(".lc-session-end"),oe=r.querySelector(".lc-session-end-btn"),ae=r.querySelector(".lc-emoji-btn"),ve=r.querySelector(".lc-emoji-pop"),Ot=r.querySelector(".lc-emoji-tabs"),Lt=r.querySelector(".lc-emoji-grid");function Ls(c){var g,b;const d=(g=h.selectionStart)!=null?g:h.value.length,u=(b=h.selectionEnd)!=null?b:d;h.value=h.value.slice(0,d)+c+h.value.slice(u);const y=d+c.length;h.setSelectionRange(y,y),h.focus()}function Rs(c){const d=Me[c];d&&(Lt.innerHTML=d.emojis.map(u=>`<button type="button" class="lc-emoji-pick" data-emoji="${u}">${u}</button>`).join(""))}ae.addEventListener("click",c=>{c.stopPropagation(),ve.style.display=ve.style.display==="none"?"block":"none"}),r.addEventListener("click",c=>{c.target instanceof Node&&!ve.contains(c.target)&&c.target!==ae&&(ve.style.display="none")}),Ot.addEventListener("click",c=>{var u;const d=c.target.closest(".lc-emoji-tab");d&&(Ot.querySelectorAll(".lc-emoji-tab").forEach(y=>y.classList.remove("lc-emoji-tab-active")),d.classList.add("lc-emoji-tab-active"),Rs(Number((u=d.getAttribute("data-cat"))!=null?u:0)))}),Lt.addEventListener("click",c=>{var u;const d=c.target.closest(".lc-emoji-pick");d&&Ls((u=d.getAttribute("data-emoji"))!=null?u:"")}),h.addEventListener("input",()=>{var u;const c=h.value,d=Pn(c);if(d!==c){const y=d.length-c.length,g=((u=h.selectionStart)!=null?u:c.length)+y;h.value=d,h.setSelectionRange(g,g)}});function we(){var c;(c=t.socket)==null||c.disconnect(),t.socket=null,t.sessionId=null,t.sessionClosed=!1,t.messages=[],t.askedForEmail=!1,t.unread=0;try{localStorage.removeItem(Pe)}catch(d){}try{localStorage.removeItem(De)}catch(d){}try{localStorage.removeItem(je)}catch(d){}W.style.display="none",h.disabled=!1,H.disabled=!1,j.disabled=!1,i!=null&&i.welcomeMessage&&(t.messages.push({id:"welcome",role:"agent",content:i.welcomeMessage,createdAt:new Date().toISOString()}),Z(t.messages)),s()}oe.addEventListener("click",we);const T=[],Bs=Date.now();let _e=!1;h.addEventListener("keydown",()=>{_e=!0}),h.addEventListener("input",()=>{_e=!0});function Rt(c){h.value=c,_e=!0,N.requestSubmit()}r._submitFromChip=Rt;const Bt=()=>{var u;const c=t.messages.some(y=>y.role==="visitor"),d=((u=i.welcomeQuickReplies)!=null?u:[]).filter(Boolean);if(c||d.length===0){w.style.display="none",w.innerHTML="";return}w.style.display="flex",w.innerHTML=d.map((y,g)=>`<button data-i="${g}" type="button">${E(y)}</button>`).join(""),w.querySelectorAll("button").forEach(y=>{y.addEventListener("click",()=>{const g=Number(y.dataset.i),b=d[g];b&&Rt(b)})})};j.addEventListener("click",()=>q.click()),q.addEventListener("change",async()=>{var y;const c=(y=q.files)==null?void 0:y[0];if(q.value="",!c)return;if(c.size>10*1024*1024){P(r,`File too large: ${c.name} (max 10 MB)`);return}if(T.length>=5){P(r,"You can attach up to 5 files per message.");return}if(!t.sessionId){P(r,"Send a message first, then attach files.");return}const d=c.type.startsWith("image/")?URL.createObjectURL(c):void 0,u={id:"pending-"+Date.now(),mimeType:c.type,sizeBytes:c.size,originalFilename:c.name,url:"",localUrl:d};T.push(u),J();try{const g=await O(e,t.sessionId,c),b=T.indexOf(u);b>=0&&(T[b]=te(G({},g),{localUrl:d})),J()}catch(g){const b=T.indexOf(u);b>=0&&T.splice(b,1),d&&URL.revokeObjectURL(d),P(r,`Upload failed: ${g.message}`),J()}});function J(){if(!T.length){f.style.display="none",f.innerHTML="";return}f.style.display="flex",f.innerHTML=T.map((c,d)=>{var k;const u=c.id.startsWith("pending-"),y=(k=c.localUrl)!=null?k:"",b=c.mimeType.startsWith("image/")&&y?`<img class="lc-chip-thumb" src="${E(y)}" alt="">`:"",A=u?`${b}<span class="lc-chip-label lc-chip-uploading">Uploading…</span>`:`${b}<span class="lc-chip-label">${E(c.originalFilename)}</span><button data-i="${d}" aria-label="Remove">×</button>`;return`<span class="lc-chip${u?" lc-chip--busy":""}">${A}</span>`}).join(""),f.querySelectorAll("button[data-i]").forEach(c=>{c.addEventListener("click",()=>{const d=Number(c.dataset.i),u=T.splice(d,1)[0];u!=null&&u.localUrl&&URL.revokeObjectURL(u.localUrl),J()})})}let Fe=null,Ct=!1;const ce=c=>{var d;Ct!==c&&(Ct=c,(d=t.socket)==null||d.emit("livechat:typing",{on:c}))};h.addEventListener("input",()=>{h.style.height="auto",h.style.height=Math.min(120,h.scrollHeight)+"px",h.value.trim()?(ce(!0),Fe&&clearTimeout(Fe),Fe=setTimeout(()=>ce(!1),1500)):ce(!1)}),h.addEventListener("blur",()=>ce(!1)),h.addEventListener("keydown",c=>{c.key==="Enter"&&!c.shiftKey&&(c.preventDefault(),N.requestSubmit())}),h.addEventListener("paste",async c=>{var y;const d=(y=c.clipboardData)==null?void 0:y.items;if(!d)return;const u=[];for(const g of d)if(g.kind==="file"&&g.type.startsWith("image/")){const b=g.getAsFile();b&&u.push(b)}if(u.length){if(c.preventDefault(),!t.sessionId){P(r,"Send a message first, then paste images.");return}for(const g of u){if(g.size>10*1024*1024){P(r,`Pasted image too large: ${g.name||"image"} (max 10 MB)`);continue}if(T.length>=5)break;const b=g.name?g:new File([g],`pasted-${Date.now()}.png`,{type:g.type}),A=URL.createObjectURL(b),k={id:"pending-"+Math.random().toString(36).slice(2),mimeType:g.type,sizeBytes:g.size,originalFilename:b.name,url:"",localUrl:A};T.push(k),J();try{const F=await O(e,t.sessionId,b),R=T.indexOf(k);R>=0&&(T[R]=te(G({},F),{localUrl:A})),J()}catch(F){const R=T.indexOf(k);R>=0&&T.splice(R,1),URL.revokeObjectURL(A),P(r,`Upload failed: ${F.message}`),J()}}}}),N.addEventListener("submit",async c=>{var g;if(c.preventDefault(),B.value)return;if(t.sessionClosed){P(r,"This conversation has ended. Start a new chat below.");return}const d=h.value.trim(),u=T.some(b=>b.id.startsWith("pending-")),y=T.filter(b=>b.url&&!b.id.startsWith("pending-"));if(u&&!d){P(r,"Your file is still uploading — please wait or add a message.");return}if(!(!d&&!y.length)){if(!es()){P(r,"Slow down — too many messages in the last minute.");return}H.disabled=!0,h.value="",h.style.height="auto",ce(!1),Zn(t,d,y),T.length=0,J(),Bt(),s(),yt(r);try{const b=await zt(e,d,y.map(A=>A.id),{hp:B.value||void 0,elapsedMs:Date.now()-Bs,hadInteraction:_e});if(ie(r),t.sessionId=b.sessionId,ns(b.sessionId),"content"in b.agent&&b.agent.content){const A=(g=b.agent.id)!=null?g:"";t.messages.some(k=>k.id===A&&A)||bt(t,b.agent.content,A)}t.socket||mt(e,t,s,i),Gn(r,t,s)}catch(b){ie(r),P(r,"Could not send — please try again.")}H.disabled=!1,s()}});const $t=r.querySelector(".lc-messages");return $t.addEventListener("click",async c=>{var g,b;const d=c.target,u=d.closest(".lc-inline-skip");if(u){const A=u.getAttribute("data-step");if(A==="name")try{localStorage.setItem(ye,"skipped")}catch(k){}else if(A==="email")try{localStorage.setItem(ze,"skipped")}catch(k){}t.messages=t.messages.filter(k=>k.id!==`identify-${A}`),s();return}const y=d.closest(".lc-inline-save");if(y){const A=y.getAttribute("data-step"),k=y.closest(".lc-inline-identify"),F=k==null?void 0:k.querySelector("input"),R=(b=(g=F==null?void 0:F.value)==null?void 0:g.trim())!=null?b:"";if(A==="name"){if(!R)return;try{await Ve(e,{name:R}),t.knownName=R;try{localStorage.setItem(ye,R)}catch(X){}const ee=t.messages.findIndex(X=>X.id==="identify-name");ee>=0&&(t.messages[ee]={id:"identify-name-done",role:"system",content:`Nice to meet you, ${R}!`,createdAt:new Date().toISOString()}),s()}catch(ee){}}else if(A==="email"){const ee=X=>{var qt;F==null||F.classList.add("lc-inline-input--invalid");let K=k==null?void 0:k.querySelector(".lc-inline-error");!K&&k&&(K=document.createElement("div"),K.className="lc-inline-error",(qt=k.querySelector(".lc-inline-row"))==null||qt.after(K)),K&&(K.textContent=X)};if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(R)){ee("That doesn't look right — double-check?");return}if(await Un(R)){ee("Please use a permanent email — we can’t follow up on temporary inboxes.");return}try{await Ve(e,{email:R});try{localStorage.setItem(ze,"saved")}catch(K){}try{localStorage.setItem(je,"saved")}catch(K){}const X=t.messages.findIndex(K=>K.id==="identify-email");X>=0&&(t.messages[X]={id:"identify-email-done",role:"system",content:`Great — we'll reach out at ${R} if we miss you here.`,createdAt:new Date().toISOString()}),s()}catch(X){}}}}),$t.addEventListener("keydown",c=>{const d=c;if(d.key!=="Enter")return;const u=d.target;if(!u.matches(".lc-inline-identify input"))return;d.preventDefault();const y=u.closest(".lc-inline-identify"),g=y==null?void 0:y.querySelector(".lc-inline-save");g==null||g.click()}),Bt(),r}function mt(n,e,t,s){!e.sessionId||e.socket||(e.socket=qn(n,e.sessionId,i=>{var a,x,m,_,p,I,N,h,B,H,j,q;if(i.type==="typing"){const f=e.panel;if(!f)return;i.on?yt(f):ie(f);return}if(i.type==="session_status"&&i.status==="closed"){(a=e.socket)==null||a.disconnect(),e.socket=null,e.sessionClosed=!0;const f=e.panel;if(f){const w=f.querySelector(".lc-session-end"),W=f.querySelector("textarea"),oe=f.querySelector('.lc-composer button[type="submit"]'),ae=f.querySelector(".lc-attach-btn");w&&(w.style.display="flex"),W&&(W.disabled=!0),oe&&(oe.disabled=!0),ae&&(ae.disabled=!0),e.feedbackAsked||(e.feedbackAsked=!0,e.messages.push({id:`feedback-${Date.now()}`,role:"system",content:"__feedback__",createdAt:new Date().toISOString()}))}t();return}if(i.type==="agent_stream_start"&&i.draftId){const f=e.panel;f&&ie(f),e.messages.some(w=>w.id===i.draftId)||(e.messages.push({id:i.draftId,role:"agent",content:"",createdAt:(x=i.createdAt)!=null?x:new Date().toISOString()}),t());return}if(i.type==="agent_stream_delta"&&i.draftId&&i.delta){const f=e.messages.findIndex(w=>w.id===i.draftId);f>=0&&(e.messages[f]=te(G({},e.messages[f]),{content:e.messages[f].content+i.delta}),t());return}if(i.type==="agent_stream_end"&&i.draftId&&i.messageId){const f=e.messages.findIndex(w=>w.id===i.draftId);f>=0&&(e.messages[f]=te(G({},e.messages[f]),{id:i.messageId,content:(m=i.content)!=null?m:e.messages[f].content}),Z(e.messages),e.open||(e.unread=((_=e.unread)!=null?_:0)+1,xt()),t());return}if(i.type==="agent_suggestions"&&i.messageId&&((p=i.suggestions)!=null&&p.length)){const f=e.messages.findIndex(w=>w.id===i.messageId);f>=0&&(e.messages[f]=te(G({},e.messages[f]),{suggestions:i.suggestions.slice(0,3)}),t());return}if(i.type!=="message"||!i.messageId||i.role==="visitor"||e.messages.some(f=>f.id===i.messageId))return;const r=(I=i.operatorName)!=null?I:void 0,o=(H=i.operatorAvatarUrl)!=null?H:r&&(B=(h=(N=s==null?void 0:s.operators)==null?void 0:N.find(f=>f.name===r))==null?void 0:h.avatarUrl)!=null?B:void 0;bt(e,(j=i.content)!=null?j:"",i.messageId,i.role==="operator",i.attachments,r,o);const l=e.panel;l&&ie(l),e.open||(e.unread=((q=e.unread)!=null?q:0)+1,xt()),t()}))}function Xn(n,e){const t=n.querySelector(".lc-messages");if(!t)return;if(e.messages.length===0){t.innerHTML='<div class="lc-empty">Send us a message — we will get right back to you.</div>';return}const s=(()=>{for(let i=e.messages.length-1;i>=0;i--){const r=e.messages[i];if(r.role==="agent"||r.role==="operator")return i;if(r.role==="visitor")return-1}return-1})();t.innerHTML=e.messages.map((i,r)=>{var I,N;if(i.content==="__identify_name__"||i.content==="__identify_email__"){const h=i.content==="__identify_name__",B=h?"name":"email",H=!h&&e.knownName?`<span class="lc-inline-greet">Thanks ${E(e.knownName)}! </span>`:"",j=h?"Mind if I get your name?":`${H}If we miss you here, what's the best email to follow up on?`,q=h?"Your name":"you@example.com",f=h?"text":"email",w=h?"given-name":"email";return`<div class="lc-msg-row lc-msg-row-agent">
          <div class="lc-msg-avatar lc-msg-avatar-ai">${kt()}</div>
          <div class="lc-msg-body">
            <div class="lc-msg lc-msg-agent lc-inline-identify" data-step="${B}">
              <div class="lc-inline-prompt">${j}</div>
              <div class="lc-inline-row">
                <input type="${f}" class="lc-inline-input" placeholder="${q}" autocomplete="${w}" />
                <button type="button" class="lc-inline-save" data-step="${B}" aria-label="Save">${_t()}</button>
              </div>
              <button type="button" class="lc-inline-skip" data-step="${B}">${h?"Skip":"Maybe later"}</button>
            </div>
          </div>
        </div>`}const o=i.content?i.role==="visitor"?os(i.content):as(i.content):"",l=((I=i.attachments)!=null?I:[]).map(rs).join(""),a=l?`<div class="lc-attachments">${l}</div>`:"",x=ls(i.createdAt),m=x?`<div class="lc-msg-time">${x}</div>`:"",_=r===s&&i.suggestions&&i.suggestions.length?`<div class="lc-chips">${i.suggestions.map(h=>`<button class="lc-chip" data-chip="${$(h)}">${E(h)}</button>`).join("")}</div>`:"";if(i.role==="system")return i.content==="__feedback__"?`<div class="lc-msg lc-msg-system lc-feedback" data-feedback-id="${$(i.id)}">
            <span>How was this chat?</span>
            <button class="lc-fb-btn" data-rating="up" aria-label="Good">👍</button>
            <button class="lc-fb-btn" data-rating="down" aria-label="Bad">👎</button>
          </div>`:`<div class="lc-msg lc-msg-system">${o}</div>`;if(i.role==="visitor")return`<div class="lc-msg-row lc-msg-row-visitor">
          <div class="lc-msg-body">
            <div class="lc-msg lc-msg-visitor">${o}${a}</div>
            ${m}
          </div>
        </div>`;const p=i.id&&i.id!=="welcome"?`<div class="lc-msg-rating" data-msg-id="${$(i.id)}">
            <button class="lc-rate-btn" data-rating="up" aria-label="Helpful">&#128077;</button>
            <button class="lc-rate-btn" data-rating="down" aria-label="Not helpful">&#128078;</button>
           </div>`:"";if(i.role==="operator"){const h=(N=i.operatorName)!=null?N:"Operator";return`<div class="lc-msg-row lc-msg-row-agent">
          ${i.operatorAvatarUrl?`<img class="lc-msg-avatar lc-msg-avatar-img" src="${$(i.operatorAvatarUrl)}" alt="${E(h)}">`:`<div class="lc-msg-avatar lc-msg-avatar-op" title="${E(h)}">${E(Ue(h))}</div>`}
          <div class="lc-msg-body">
            <div class="lc-msg-sender">${E(h)}</div>
            <div class="lc-msg lc-msg-agent">${o}${a}</div>
            ${m}
            ${_}
            ${p}
          </div>
        </div>`}return`<div class="lc-msg-row lc-msg-row-agent">
        <div class="lc-msg-avatar lc-msg-avatar-ai">${kt()}</div>
        <div class="lc-msg-body">
          <div class="lc-msg lc-msg-agent">${o}${a}</div>
          ${m}
          ${_}
          ${p}
        </div>
      </div>`}).join(""),t.querySelectorAll(".lc-msg-rating").forEach(i=>{i.querySelectorAll(".lc-rate-btn").forEach(r=>{r.addEventListener("click",async()=>{var m,_,p;const o=r.getAttribute("data-rating"),l=(m=i.getAttribute("data-msg-id"))!=null?m:"",a=(p=(_=n._state)==null?void 0:_.sessionId)!=null?p:"",x=n._cfg;if(!(!l||!a||!x)){i.querySelectorAll(".lc-rate-btn").forEach(I=>I.disabled=!0),r.classList.add("lc-rate-btn--active");try{await fetch(`${x.apiBase}/livechat/session/${encodeURIComponent(a)}/message/${encodeURIComponent(l)}/rating`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({siteKey:x.siteKey,visitorId:x.visitorId,rating:o}),credentials:"omit"})}catch(I){}}})})}),t.querySelectorAll(".lc-chip").forEach(i=>{i.addEventListener("click",()=>{var l;const r=(l=i.getAttribute("data-chip"))!=null?l:"";if(!r)return;const o=n._submitFromChip;if(o)o(r);else{const a=n.querySelector("textarea"),x=n.querySelector(".lc-composer");if(!a||!x)return;a.value=r,a.dispatchEvent(new Event("input",{bubbles:!0})),x.requestSubmit()}})}),t.querySelectorAll(".lc-fb-btn").forEach(i=>{i.addEventListener("click",async()=>{const r=i.closest(".lc-feedback"),o=i.getAttribute("data-rating");if(!r||!o)return;const l=e.sessionId,a=e.cfg;if(l&&a)try{await fetch(`${a.apiBase}/livechat/session/${encodeURIComponent(l)}/feedback`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({siteKey:a.siteKey,visitorId:a.visitorId,rating:o}),credentials:"omit"})}catch(x){}r.innerHTML="<span>Thanks for the feedback!</span>"})}),gt(n)}function gt(n){const e=n.querySelector(".lc-messages");e&&(e.scrollTop=e.scrollHeight)}function yt(n){const e=n.querySelector(".lc-messages");if(!e||e.querySelector(".lc-typing"))return;const t=document.createElement("div");t.className="lc-typing",t.innerHTML="<span></span><span></span><span></span>",e.appendChild(t),e.scrollTop=e.scrollHeight}function ie(n){n.querySelectorAll(".lc-typing").forEach(e=>e.remove())}function Gn(n,e,t){let s=!1;try{s=!!localStorage.getItem(je)}catch(p){}const i=e.messages,r=i.filter(p=>p.role==="visitor").length,o=i.filter(p=>p.role==="agent").length;let l=null;try{l=localStorage.getItem(ye)}catch(p){}const a=!!l||!!e.knownName||s,x=i.some(p=>p.id==="identify-name"||p.id==="identify-name-done");!a&&!x&&o>=1&&(e.askedForName=!0,e.messages.push({id:"identify-name",role:"agent",content:"__identify_name__",createdAt:new Date().toISOString()}),t());let m=!1;try{m=!!localStorage.getItem(ze)}catch(p){}const _=i.some(p=>p.id==="identify-email"||p.id==="identify-email-done");!m&&!s&&!_&&r>=Yn&&(e.askedForEmail=!0,e.messages.push({id:"identify-email",role:"agent",content:"__identify_email__",createdAt:new Date().toISOString()}),t())}function Qn(){try{const n=localStorage.getItem(ye);return!n||n==="saved"||n==="skipped"?null:n}catch(n){return null}}function Zn(n,e,t){n.messages.push({id:"local-"+Date.now(),role:"visitor",content:e,createdAt:new Date().toISOString(),attachments:t}),Z(n.messages)}function bt(n,e,t,s=!1,i,r,o){n.messages.push({id:t||"srv-"+Date.now(),role:s?"operator":"agent",content:e,createdAt:new Date().toISOString(),attachments:i,operatorName:r,operatorAvatarUrl:o}),Z(n.messages)}function es(){var n;try{const e=Date.now(),t=JSON.parse((n=localStorage.getItem(ft))!=null?n:"[]").filter(s=>e-s<Vn);return t.length>=Kn?!1:(t.push(e),localStorage.setItem(ft,JSON.stringify(t)),!0)}catch(e){return!0}}function ts(){try{return localStorage.getItem(Pe)}catch(n){return null}}function ns(n){try{localStorage.setItem(Pe,n)}catch(e){}}function ss(){try{const n=localStorage.getItem(De);return n?JSON.parse(n):[]}catch(n){return[]}}function Z(n){try{localStorage.setItem(De,JSON.stringify(n.slice(-50)))}catch(e){}}function xt(){try{const n=new(window.AudioContext||window.webkitAudioContext),e=n.createOscillator(),t=n.createGain();e.connect(t),t.connect(n.destination),e.type="sine",e.frequency.setValueAtTime(880,n.currentTime),e.frequency.setValueAtTime(1100,n.currentTime+.08),t.gain.setValueAtTime(.12,n.currentTime),t.gain.exponentialRampToValueAtTime(.001,n.currentTime+.35),e.start(n.currentTime),e.stop(n.currentTime+.35)}catch(n){}}function E(n){return n.replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}function is(n){if(!n)return null;const e=n.trim();return/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(e)?e:null}function vt(n,e){let t=n.replace("#","");t.length===3&&(t=t.split("").map(o=>o+o).join(""));const s=parseInt(t.slice(0,2),16),i=parseInt(t.slice(2,4),16),r=parseInt(t.slice(4,6),16);return`rgba(${s}, ${i}, ${r}, ${e})`}function rs(n){if(n.mimeType.startsWith("image/")&&n.url)return`<a href="${$(n.url)}" target="_blank" rel="noopener noreferrer"><img class="lc-attach-img" src="${$(n.url)}" alt="${$(n.originalFilename)}" /></a>`;const t=cs(n.sizeBytes);return`<a class="lc-attach-file" href="${n.url?$(n.url):"#"}" target="_blank" rel="noopener noreferrer">${hs()}<span>${E(n.originalFilename)}</span><span class="lc-attach-size">${t}</span></a>`}function os(n){return E(n).replace(/(https?:\/\/[^\s<]+)/g,t=>{const s=t.match(/[.,;:!?)]+$/),i=s?s[0]:"",r=i?t.slice(0,-i.length):t;return`<a href="${$(r)}" target="_blank" rel="noopener noreferrer nofollow">${r}</a>${i}`})}function as(n){let e=E(n);const t=[];return e=e.replace(/`([^`\n]+)`/g,(s,i)=>(t.push(`<code class="lc-md-code">${i}</code>`),`\0C${t.length-1}\0`)),e=e.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,(s,i,r)=>`<a href="${$(r)}" target="_blank" rel="noopener noreferrer nofollow">${i}</a>`),e=e.replace(/\*\*([^*\n]+?)\*\*/g,"<strong>$1</strong>"),e=e.replace(/(^|[\s(])\*([^*\n]+?)\*(?=[\s.,;:!?)]|$)/g,"$1<em>$2</em>"),e=e.replace(/(^|[\s>])(https?:\/\/[^\s<]+)/g,(s,i,r)=>{const o=r.match(/[.,;:!?)]+$/),l=o?o[0]:"",a=l?r.slice(0,-l.length):r;return`${i}<a href="${$(a)}" target="_blank" rel="noopener noreferrer nofollow">${a}</a>${l}`}),e=e.replace(/ C(\d+) /g,(s,i)=>{var r;return(r=t[Number(i)])!=null?r:""}),e=e.replace(/\n/g,"<br>"),e}function $(n){return n.replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}function cs(n){return n<1024?`${n} B`:n<1024*1024?`${(n/1024).toFixed(0)} KB`:`${(n/1024/1024).toFixed(1)} MB`}function P(n,e,t=3500){const s=n.querySelector(".lc-toast");s&&(s.textContent=e,s.style.display="block",clearTimeout(s._timer),s._timer=setTimeout(()=>{s.style.display="none"},t))}function Ue(n){return n.trim().split(/\s+/).map(e=>{var t;return(t=e[0])!=null?t:""}).join("").slice(0,2).toUpperCase()}function ls(n){try{const e=new Date(n);return isNaN(e.getTime())?"":e.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}catch(e){return""}}function ds(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 17.93 8.83l-8.58 8.57a2 2 0 1 1-2.83-2.83l8.49-8.48"/></svg>'}function hs(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>'}function ps(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'}function us(){return'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>'}function wt(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>'}function _t(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>'}function fs(){return'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="6" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="18" r="1.5"/></svg>'}function ms(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15.5-6.36L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.36L3 16"/><path d="M3 21v-5h5"/></svg>'}function gs(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'}function ys(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>'}function kt(){return'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4M22 5h-4M4 17v2M5 18H3"/></svg>'}function bs(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>'}function xs(n,e){return!n.length&&(e!=null&&e.trim())?`<div class="lc-header-avatars"><div class="lc-op-avatar lc-op-initials" style="z-index:3">${E(Ue(e.trim()))}</div></div>`:n.length?`<div class="lc-header-avatars">${n.slice(0,3).map((i,r)=>{const o=r===0?"":"margin-left:-10px;",l=`z-index:${3-r};`;return i.avatarUrl?`<img class="lc-op-avatar" src="${$(i.avatarUrl)}" alt="${E(i.name)}" style="${l}${o}">`:`<div class="lc-op-avatar lc-op-initials" style="${l}${o}">${E(Ue(i.name))}</div>`}).join("")}</div>`:`<div class="lc-header-avatar">${us()}</div>`}let St="",re=null,xe=null;const vs=3e4;function ws(n){Et(n),ks(n),window.addEventListener("popstate",()=>He(n)),window.addEventListener("pagehide",()=>{re&&Ke(n,re)}),_s(n)}function _s(n){const e=()=>{document.visibilityState==="visible"&&jt(n,{url:location.href,title:document.title})};setInterval(e,vs),document.addEventListener("visibilitychange",()=>{document.visibilityState==="visible"&&e()})}function ks(n){const e={pushState:history.pushState,replaceState:history.replaceState};history.pushState=function(...t){const s=e.pushState.apply(this,t);return He(n),s},history.replaceState=function(...t){const s=e.replaceState.apply(this,t);return He(n),s}}function He(n){xe&&clearTimeout(xe),xe=setTimeout(()=>Et(n),300)}async function Et(n){var t;xe=null;const e=location.pathname+location.search;if(e!==St){St=e,re&&Ke(n,re);try{re=(t=(await Pt(n,{url:location.href,path:location.pathname,title:document.title,referrer:document.referrer,language:navigator.language})).pageviewId)!=null?t:null}catch(s){}}}const Tt="livechat_visitor_id";function Ss(){const n=Es();if(!n)return null;const e=n.getAttribute("data-site");if(!e)return null;const t=n.getAttribute("data-api")||Ts(n)||"",s=As();return{siteKey:e,visitorId:s,apiBase:t}}function Es(){const n=document.querySelectorAll("script[data-site]");return n.length?n[n.length-1]:null}function Ts(n){if(!n.src)return null;try{const e=new URL(n.src);return`${e.protocol}//${e.host}`}catch(e){return null}}function As(){try{const n=localStorage.getItem(Tt);if(n)return n;const e=At();return localStorage.setItem(Tt,e),e}catch(n){return At()}}function At(){if(typeof crypto!="undefined"&&crypto.randomUUID)return crypto.randomUUID();let n=Date.now();return"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,e=>{const t=(n+Math.random()*16)%16|0;return n=Math.floor(n/16),(e==="x"?t:t&3|8).toString(16)})}const It="livechat_build",Is=["livechat_messages_cache","livechat_session_id","livechat_identify_dismissed","livechat_send_log","livechat_proactive_seen"];function Os(){try{localStorage.getItem(It)!=="mon7qra2"&&(Is.forEach(n=>localStorage.removeItem(n)),localStorage.setItem(It,"mon7qra2"))}catch(n){}}(function(){var s;if(typeof window=="undefined"||(s=window.__livechat__)!=null&&s.mounted)return;Os();const e=Ss();if(!e)return;window.__livechat__={mounted:!0,siteKey:e.siteKey,visitorId:e.visitorId},ws(e);const t=async()=>{const i=await M(e);Wn(e,i!=null?i:void 0)};document.readyState==="loading"?document.addEventListener("DOMContentLoaded",t):t()})()})();
