var Di=Object.defineProperty,Pi=Object.defineProperties;var ji=Object.getOwnPropertyDescriptors;var zt=Object.getOwnPropertySymbols;var zi=Object.prototype.hasOwnProperty,Ui=Object.prototype.propertyIsEnumerable;var Ut=(D,O,L)=>O in D?Di(D,O,{enumerable:!0,configurable:!0,writable:!0,value:L}):D[O]=L,Q=(D,O)=>{for(var L in O||(O={}))zi.call(O,L)&&Ut(D,L,O[L]);if(zt)for(var L of zt(O))Ui.call(O,L)&&Ut(D,L,O[L]);return D},ne=(D,O)=>Pi(D,ji(O));(function(){"use strict";async function D(n){try{const e=await fetch(`${n.apiBase}/livechat/config?siteKey=${encodeURIComponent(n.siteKey)}`,{method:"GET",credentials:"omit"});return e.ok?await e.json():null}catch(e){return null}}async function O(n,e,t){const i=new FormData;i.append("siteKey",n.siteKey),i.append("visitorId",n.visitorId),i.append("sessionId",e),i.append("file",t,t.name);const s=await fetch(`${n.apiBase}/livechat/upload`,{method:"POST",body:i,credentials:"omit"});if(!s.ok){const r=await s.text().catch(()=>"");throw new Error(`${s.status} ${s.statusText}${r?` — ${r}`:""}`)}return s.json()}async function L(n,e){const t=await fetch(n,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(e),credentials:"omit"});if(!t.ok){const i=await t.text().catch(()=>"");throw new Error(`${t.status} ${t.statusText}${i?` — ${i}`:""}`)}return t.json()}function Ht(n,e){return L(`${n.apiBase}/livechat/track/pageview`,Q({siteKey:n.siteKey,visitorId:n.visitorId},e))}function Ft(n,e){return L(`${n.apiBase}/livechat/track/heartbeat`,{siteKey:n.siteKey,visitorId:n.visitorId,url:e.url,title:e.title}).catch(()=>{})}function Ke(n,e){const t=`${n.apiBase}/livechat/track/leave`,i=JSON.stringify({siteKey:n.siteKey,visitorId:n.visitorId,pageviewId:e});if(navigator.sendBeacon){const s=new Blob([i],{type:"application/json"});navigator.sendBeacon(t,s);return}fetch(t,{method:"POST",headers:{"Content-Type":"application/json"},body:i,keepalive:!0}).catch(()=>{})}function Kt(n,e,t,i){return L(`${n.apiBase}/livechat/message`,{siteKey:n.siteKey,visitorId:n.visitorId,content:e,attachmentIds:t&&t.length?t:void 0,meta:i})}function Ve(n,e){return L(`${n.apiBase}/livechat/identify`,{siteKey:n.siteKey,visitorId:n.visitorId,email:e.email,name:e.name})}const H=Object.create(null);H.open="0",H.close="1",H.ping="2",H.pong="3",H.message="4",H.upgrade="5",H.noop="6";const ce=Object.create(null);Object.keys(H).forEach(n=>{ce[H[n]]=n});const ke={type:"error",data:"parser error"},Ye=typeof Blob=="function"||typeof Blob!="undefined"&&Object.prototype.toString.call(Blob)==="[object BlobConstructor]",We=typeof ArrayBuffer=="function",Je=n=>typeof ArrayBuffer.isView=="function"?ArrayBuffer.isView(n):n&&n.buffer instanceof ArrayBuffer,Se=({type:n,data:e},t,i)=>Ye&&e instanceof Blob?t?i(e):Xe(e,i):We&&(e instanceof ArrayBuffer||Je(e))?t?i(e):Xe(new Blob([e]),i):i(H[n]+(e||"")),Xe=(n,e)=>{const t=new FileReader;return t.onload=function(){const i=t.result.split(",")[1];e("b"+(i||""))},t.readAsDataURL(n)};function Ge(n){return n instanceof Uint8Array?n:n instanceof ArrayBuffer?new Uint8Array(n):new Uint8Array(n.buffer,n.byteOffset,n.byteLength)}let Ee;function Vt(n,e){if(Ye&&n.data instanceof Blob)return n.data.arrayBuffer().then(Ge).then(e);if(We&&(n.data instanceof ArrayBuffer||Je(n.data)))return e(Ge(n.data));Se(n,!1,t=>{Ee||(Ee=new TextEncoder),e(Ee.encode(t))})}const Qe="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",ie=typeof Uint8Array=="undefined"?[]:new Uint8Array(256);for(let n=0;n<Qe.length;n++)ie[Qe.charCodeAt(n)]=n;const Yt=n=>{let e=n.length*.75,t=n.length,i,s=0,r,o,l,a;n[n.length-1]==="="&&(e--,n[n.length-2]==="="&&e--);const b=new ArrayBuffer(e),x=new Uint8Array(b);for(i=0;i<t;i+=4)r=ie[n.charCodeAt(i)],o=ie[n.charCodeAt(i+1)],l=ie[n.charCodeAt(i+2)],a=ie[n.charCodeAt(i+3)],x[s++]=r<<2|o>>4,x[s++]=(o&15)<<4|l>>2,x[s++]=(l&3)<<6|a&63;return b},Wt=typeof ArrayBuffer=="function",Te=(n,e)=>{if(typeof n!="string")return{type:"message",data:Ze(n,e)};const t=n.charAt(0);return t==="b"?{type:"message",data:Jt(n.substring(1),e)}:ce[t]?n.length>1?{type:ce[t],data:n.substring(1)}:{type:ce[t]}:ke},Jt=(n,e)=>{if(Wt){const t=Yt(n);return Ze(t,e)}else return{base64:!0,data:n}},Ze=(n,e)=>{switch(e){case"blob":return n instanceof Blob?n:new Blob([n]);case"arraybuffer":default:return n instanceof ArrayBuffer?n:n.buffer}},et="",Xt=(n,e)=>{const t=n.length,i=new Array(t);let s=0;n.forEach((r,o)=>{Se(r,!1,l=>{i[o]=l,++s===t&&e(i.join(et))})})},Gt=(n,e)=>{const t=n.split(et),i=[];for(let s=0;s<t.length;s++){const r=Te(t[s],e);if(i.push(r),r.type==="error")break}return i};function Qt(){return new TransformStream({transform(n,e){Vt(n,t=>{const i=t.length;let s;if(i<126)s=new Uint8Array(1),new DataView(s.buffer).setUint8(0,i);else if(i<65536){s=new Uint8Array(3);const r=new DataView(s.buffer);r.setUint8(0,126),r.setUint16(1,i)}else{s=new Uint8Array(9);const r=new DataView(s.buffer);r.setUint8(0,127),r.setBigUint64(1,BigInt(i))}n.data&&typeof n.data!="string"&&(s[0]|=128),e.enqueue(s),e.enqueue(t)})}})}let Ae;function le(n){return n.reduce((e,t)=>e+t.length,0)}function de(n,e){if(n[0].length===e)return n.shift();const t=new Uint8Array(e);let i=0;for(let s=0;s<e;s++)t[s]=n[0][i++],i===n[0].length&&(n.shift(),i=0);return n.length&&i<n[0].length&&(n[0]=n[0].slice(i)),t}function Zt(n,e){Ae||(Ae=new TextDecoder);const t=[];let i=0,s=-1,r=!1;return new TransformStream({transform(o,l){for(t.push(o);;){if(i===0){if(le(t)<1)break;const a=de(t,1);r=(a[0]&128)===128,s=a[0]&127,s<126?i=3:s===126?i=1:i=2}else if(i===1){if(le(t)<2)break;const a=de(t,2);s=new DataView(a.buffer,a.byteOffset,a.length).getUint16(0),i=3}else if(i===2){if(le(t)<8)break;const a=de(t,8),b=new DataView(a.buffer,a.byteOffset,a.length),x=b.getUint32(0);if(x>Math.pow(2,21)-1){l.enqueue(ke);break}s=x*Math.pow(2,32)+b.getUint32(4),i=3}else{if(le(t)<s)break;const a=de(t,s);l.enqueue(Te(r?a:Ae.decode(a),e)),i=0}if(s===0||s>n){l.enqueue(ke);break}}}})}const tt=4;function T(n){if(n)return en(n)}function en(n){for(var e in T.prototype)n[e]=T.prototype[e];return n}T.prototype.on=T.prototype.addEventListener=function(n,e){return this._callbacks=this._callbacks||{},(this._callbacks["$"+n]=this._callbacks["$"+n]||[]).push(e),this},T.prototype.once=function(n,e){function t(){this.off(n,t),e.apply(this,arguments)}return t.fn=e,this.on(n,t),this},T.prototype.off=T.prototype.removeListener=T.prototype.removeAllListeners=T.prototype.removeEventListener=function(n,e){if(this._callbacks=this._callbacks||{},arguments.length==0)return this._callbacks={},this;var t=this._callbacks["$"+n];if(!t)return this;if(arguments.length==1)return delete this._callbacks["$"+n],this;for(var i,s=0;s<t.length;s++)if(i=t[s],i===e||i.fn===e){t.splice(s,1);break}return t.length===0&&delete this._callbacks["$"+n],this},T.prototype.emit=function(n){this._callbacks=this._callbacks||{};for(var e=new Array(arguments.length-1),t=this._callbacks["$"+n],i=1;i<arguments.length;i++)e[i-1]=arguments[i];if(t){t=t.slice(0);for(var i=0,s=t.length;i<s;++i)t[i].apply(this,e)}return this},T.prototype.emitReserved=T.prototype.emit,T.prototype.listeners=function(n){return this._callbacks=this._callbacks||{},this._callbacks["$"+n]||[]},T.prototype.hasListeners=function(n){return!!this.listeners(n).length};const he=typeof Promise=="function"&&typeof Promise.resolve=="function"?e=>Promise.resolve().then(e):(e,t)=>t(e,0),N=typeof self!="undefined"?self:typeof window!="undefined"?window:Function("return this")(),tn="arraybuffer";function Hi(){}function nt(n,...e){return e.reduce((t,i)=>(n.hasOwnProperty(i)&&(t[i]=n[i]),t),{})}const nn=N.setTimeout,sn=N.clearTimeout;function pe(n,e){e.useNativeTimers?(n.setTimeoutFn=nn.bind(N),n.clearTimeoutFn=sn.bind(N)):(n.setTimeoutFn=N.setTimeout.bind(N),n.clearTimeoutFn=N.clearTimeout.bind(N))}const rn=1.33;function on(n){return typeof n=="string"?an(n):Math.ceil((n.byteLength||n.size)*rn)}function an(n){let e=0,t=0;for(let i=0,s=n.length;i<s;i++)e=n.charCodeAt(i),e<128?t+=1:e<2048?t+=2:e<55296||e>=57344?t+=3:(i++,t+=4);return t}function it(){return Date.now().toString(36).substring(3)+Math.random().toString(36).substring(2,5)}function cn(n){let e="";for(let t in n)n.hasOwnProperty(t)&&(e.length&&(e+="&"),e+=encodeURIComponent(t)+"="+encodeURIComponent(n[t]));return e}function ln(n){let e={},t=n.split("&");for(let i=0,s=t.length;i<s;i++){let r=t[i].split("=");e[decodeURIComponent(r[0])]=decodeURIComponent(r[1])}return e}class dn extends Error{constructor(e,t,i){super(e),this.description=t,this.context=i,this.type="TransportError"}}class Ie extends T{constructor(e){super(),this.writable=!1,pe(this,e),this.opts=e,this.query=e.query,this.socket=e.socket,this.supportsBinary=!e.forceBase64}onError(e,t,i){return super.emitReserved("error",new dn(e,t,i)),this}open(){return this.readyState="opening",this.doOpen(),this}close(){return(this.readyState==="opening"||this.readyState==="open")&&(this.doClose(),this.onClose()),this}send(e){this.readyState==="open"&&this.write(e)}onOpen(){this.readyState="open",this.writable=!0,super.emitReserved("open")}onData(e){const t=Te(e,this.socket.binaryType);this.onPacket(t)}onPacket(e){super.emitReserved("packet",e)}onClose(e){this.readyState="closed",super.emitReserved("close",e)}pause(e){}createUri(e,t={}){return e+"://"+this._hostname()+this._port()+this.opts.path+this._query(t)}_hostname(){const e=this.opts.hostname;return e.indexOf(":")===-1?e:"["+e+"]"}_port(){return this.opts.port&&(this.opts.secure&&Number(this.opts.port)!==443||!this.opts.secure&&Number(this.opts.port)!==80)?":"+this.opts.port:""}_query(e){const t=cn(e);return t.length?"?"+t:""}}class hn extends Ie{constructor(){super(...arguments),this._polling=!1}get name(){return"polling"}doOpen(){this._poll()}pause(e){this.readyState="pausing";const t=()=>{this.readyState="paused",e()};if(this._polling||!this.writable){let i=0;this._polling&&(i++,this.once("pollComplete",function(){--i||t()})),this.writable||(i++,this.once("drain",function(){--i||t()}))}else t()}_poll(){this._polling=!0,this.doPoll(),this.emitReserved("poll")}onData(e){const t=i=>{if(this.readyState==="opening"&&i.type==="open"&&this.onOpen(),i.type==="close")return this.onClose({description:"transport closed by the server"}),!1;this.onPacket(i)};Gt(e,this.socket.binaryType).forEach(t),this.readyState!=="closed"&&(this._polling=!1,this.emitReserved("pollComplete"),this.readyState==="open"&&this._poll())}doClose(){const e=()=>{this.write([{type:"close"}])};this.readyState==="open"?e():this.once("open",e)}write(e){this.writable=!1,Xt(e,t=>{this.doWrite(t,()=>{this.writable=!0,this.emitReserved("drain")})})}uri(){const e=this.opts.secure?"https":"http",t=this.query||{};return this.opts.timestampRequests!==!1&&(t[this.opts.timestampParam]=it()),!this.supportsBinary&&!t.sid&&(t.b64=1),this.createUri(e,t)}}let st=!1;try{st=typeof XMLHttpRequest!="undefined"&&"withCredentials"in new XMLHttpRequest}catch(n){}const pn=st;function un(){}class fn extends hn{constructor(e){if(super(e),typeof location!="undefined"){const t=location.protocol==="https:";let i=location.port;i||(i=t?"443":"80"),this.xd=typeof location!="undefined"&&e.hostname!==location.hostname||i!==e.port}}doWrite(e,t){const i=this.request({method:"POST",data:e});i.on("success",t),i.on("error",(s,r)=>{this.onError("xhr post error",s,r)})}doPoll(){const e=this.request();e.on("data",this.onData.bind(this)),e.on("error",(t,i)=>{this.onError("xhr poll error",t,i)}),this.pollXhr=e}}class F extends T{constructor(e,t,i){super(),this.createRequest=e,pe(this,i),this._opts=i,this._method=i.method||"GET",this._uri=t,this._data=i.data!==void 0?i.data:null,this._create()}_create(){var e;const t=nt(this._opts,"agent","pfx","key","passphrase","cert","ca","ciphers","rejectUnauthorized","autoUnref");t.xdomain=!!this._opts.xd;const i=this._xhr=this.createRequest(t);try{i.open(this._method,this._uri,!0);try{if(this._opts.extraHeaders){i.setDisableHeaderCheck&&i.setDisableHeaderCheck(!0);for(let s in this._opts.extraHeaders)this._opts.extraHeaders.hasOwnProperty(s)&&i.setRequestHeader(s,this._opts.extraHeaders[s])}}catch(s){}if(this._method==="POST")try{i.setRequestHeader("Content-type","text/plain;charset=UTF-8")}catch(s){}try{i.setRequestHeader("Accept","*/*")}catch(s){}(e=this._opts.cookieJar)===null||e===void 0||e.addCookies(i),"withCredentials"in i&&(i.withCredentials=this._opts.withCredentials),this._opts.requestTimeout&&(i.timeout=this._opts.requestTimeout),i.onreadystatechange=()=>{var s;i.readyState===3&&((s=this._opts.cookieJar)===null||s===void 0||s.parseCookies(i.getResponseHeader("set-cookie"))),i.readyState===4&&(i.status===200||i.status===1223?this._onLoad():this.setTimeoutFn(()=>{this._onError(typeof i.status=="number"?i.status:0)},0))},i.send(this._data)}catch(s){this.setTimeoutFn(()=>{this._onError(s)},0);return}typeof document!="undefined"&&(this._index=F.requestsCount++,F.requests[this._index]=this)}_onError(e){this.emitReserved("error",e,this._xhr),this._cleanup(!0)}_cleanup(e){if(!(typeof this._xhr=="undefined"||this._xhr===null)){if(this._xhr.onreadystatechange=un,e)try{this._xhr.abort()}catch(t){}typeof document!="undefined"&&delete F.requests[this._index],this._xhr=null}}_onLoad(){const e=this._xhr.responseText;e!==null&&(this.emitReserved("data",e),this.emitReserved("success"),this._cleanup())}abort(){this._cleanup()}}if(F.requestsCount=0,F.requests={},typeof document!="undefined"){if(typeof attachEvent=="function")attachEvent("onunload",rt);else if(typeof addEventListener=="function"){const n="onpagehide"in N?"pagehide":"unload";addEventListener(n,rt,!1)}}function rt(){for(let n in F.requests)F.requests.hasOwnProperty(n)&&F.requests[n].abort()}const mn=(function(){const n=ot({xdomain:!1});return n&&n.responseType!==null})();class gn extends fn{constructor(e){super(e);const t=e&&e.forceBase64;this.supportsBinary=mn&&!t}request(e={}){return Object.assign(e,{xd:this.xd},this.opts),new F(ot,this.uri(),e)}}function ot(n){const e=n.xdomain;try{if(typeof XMLHttpRequest!="undefined"&&(!e||pn))return new XMLHttpRequest}catch(t){}if(!e)try{return new N[["Active"].concat("Object").join("X")]("Microsoft.XMLHTTP")}catch(t){}}const at=typeof navigator!="undefined"&&typeof navigator.product=="string"&&navigator.product.toLowerCase()==="reactnative";class yn extends Ie{get name(){return"websocket"}doOpen(){const e=this.uri(),t=this.opts.protocols,i=at?{}:nt(this.opts,"agent","perMessageDeflate","pfx","key","passphrase","cert","ca","ciphers","rejectUnauthorized","localAddress","protocolVersion","origin","maxPayload","family","checkServerIdentity");this.opts.extraHeaders&&(i.headers=this.opts.extraHeaders);try{this.ws=this.createSocket(e,t,i)}catch(s){return this.emitReserved("error",s)}this.ws.binaryType=this.socket.binaryType,this.addEventListeners()}addEventListeners(){this.ws.onopen=()=>{this.opts.autoUnref&&this.ws._socket.unref(),this.onOpen()},this.ws.onclose=e=>this.onClose({description:"websocket connection closed",context:e}),this.ws.onmessage=e=>this.onData(e.data),this.ws.onerror=e=>this.onError("websocket error",e)}write(e){this.writable=!1;for(let t=0;t<e.length;t++){const i=e[t],s=t===e.length-1;Se(i,this.supportsBinary,r=>{try{this.doWrite(i,r)}catch(o){}s&&he(()=>{this.writable=!0,this.emitReserved("drain")},this.setTimeoutFn)})}}doClose(){typeof this.ws!="undefined"&&(this.ws.onerror=()=>{},this.ws.close(),this.ws=null)}uri(){const e=this.opts.secure?"wss":"ws",t=this.query||{};return this.opts.timestampRequests&&(t[this.opts.timestampParam]=it()),this.supportsBinary||(t.b64=1),this.createUri(e,t)}}const Oe=N.WebSocket||N.MozWebSocket;class bn extends yn{createSocket(e,t,i){return at?new Oe(e,t,i):t?new Oe(e,t):new Oe(e)}doWrite(e,t){this.ws.send(t)}}class xn extends Ie{get name(){return"webtransport"}doOpen(){try{this._transport=new WebTransport(this.createUri("https"),this.opts.transportOptions[this.name])}catch(e){return this.emitReserved("error",e)}this._transport.closed.then(()=>{this.onClose()}).catch(e=>{this.onError("webtransport error",e)}),this._transport.ready.then(()=>{this._transport.createBidirectionalStream().then(e=>{const t=Zt(Number.MAX_SAFE_INTEGER,this.socket.binaryType),i=e.readable.pipeThrough(t).getReader(),s=Qt();s.readable.pipeTo(e.writable),this._writer=s.writable.getWriter();const r=()=>{i.read().then(({done:l,value:a})=>{l||(this.onPacket(a),r())}).catch(l=>{})};r();const o={type:"open"};this.query.sid&&(o.data=`{"sid":"${this.query.sid}"}`),this._writer.write(o).then(()=>this.onOpen())})})}write(e){this.writable=!1;for(let t=0;t<e.length;t++){const i=e[t],s=t===e.length-1;this._writer.write(i).then(()=>{s&&he(()=>{this.writable=!0,this.emitReserved("drain")},this.setTimeoutFn)})}}doClose(){var e;(e=this._transport)===null||e===void 0||e.close()}}const vn={websocket:bn,webtransport:xn,polling:gn},wn=/^(?:(?![^:@\/?#]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@\/?#]*)(?::([^:@\/?#]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/,_n=["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"];function Le(n){if(n.length>8e3)throw"URI too long";const e=n,t=n.indexOf("["),i=n.indexOf("]");t!=-1&&i!=-1&&(n=n.substring(0,t)+n.substring(t,i).replace(/:/g,";")+n.substring(i,n.length));let s=wn.exec(n||""),r={},o=14;for(;o--;)r[_n[o]]=s[o]||"";return t!=-1&&i!=-1&&(r.source=e,r.host=r.host.substring(1,r.host.length-1).replace(/;/g,":"),r.authority=r.authority.replace("[","").replace("]","").replace(/;/g,":"),r.ipv6uri=!0),r.pathNames=kn(r,r.path),r.queryKey=Sn(r,r.query),r}function kn(n,e){const t=/\/{2,9}/g,i=e.replace(t,"/").split("/");return(e.slice(0,1)=="/"||e.length===0)&&i.splice(0,1),e.slice(-1)=="/"&&i.splice(i.length-1,1),i}function Sn(n,e){const t={};return e.replace(/(?:^|&)([^&=]*)=?([^&]*)/g,function(i,s,r){s&&(t[s]=r)}),t}const Re=typeof addEventListener=="function"&&typeof removeEventListener=="function",ue=[];Re&&addEventListener("offline",()=>{ue.forEach(n=>n())},!1);class W extends T{constructor(e,t){if(super(),this.binaryType=tn,this.writeBuffer=[],this._prevBufferLen=0,this._pingInterval=-1,this._pingTimeout=-1,this._maxPayload=-1,this._pingTimeoutTime=1/0,e&&typeof e=="object"&&(t=e,e=null),e){const i=Le(e);t.hostname=i.host,t.secure=i.protocol==="https"||i.protocol==="wss",t.port=i.port,i.query&&(t.query=i.query)}else t.host&&(t.hostname=Le(t.host).host);pe(this,t),this.secure=t.secure!=null?t.secure:typeof location!="undefined"&&location.protocol==="https:",t.hostname&&!t.port&&(t.port=this.secure?"443":"80"),this.hostname=t.hostname||(typeof location!="undefined"?location.hostname:"localhost"),this.port=t.port||(typeof location!="undefined"&&location.port?location.port:this.secure?"443":"80"),this.transports=[],this._transportsByName={},t.transports.forEach(i=>{const s=i.prototype.name;this.transports.push(s),this._transportsByName[s]=i}),this.opts=Object.assign({path:"/engine.io",agent:!1,withCredentials:!1,upgrade:!0,timestampParam:"t",rememberUpgrade:!1,addTrailingSlash:!0,rejectUnauthorized:!0,perMessageDeflate:{threshold:1024},transportOptions:{},closeOnBeforeunload:!1},t),this.opts.path=this.opts.path.replace(/\/$/,"")+(this.opts.addTrailingSlash?"/":""),typeof this.opts.query=="string"&&(this.opts.query=ln(this.opts.query)),Re&&(this.opts.closeOnBeforeunload&&(this._beforeunloadEventListener=()=>{this.transport&&(this.transport.removeAllListeners(),this.transport.close())},addEventListener("beforeunload",this._beforeunloadEventListener,!1)),this.hostname!=="localhost"&&(this._offlineEventListener=()=>{this._onClose("transport close",{description:"network connection lost"})},ue.push(this._offlineEventListener))),this.opts.withCredentials&&(this._cookieJar=void 0),this._open()}createTransport(e){const t=Object.assign({},this.opts.query);t.EIO=tt,t.transport=e,this.id&&(t.sid=this.id);const i=Object.assign({},this.opts,{query:t,socket:this,hostname:this.hostname,secure:this.secure,port:this.port},this.opts.transportOptions[e]);return new this._transportsByName[e](i)}_open(){if(this.transports.length===0){this.setTimeoutFn(()=>{this.emitReserved("error","No transports available")},0);return}const e=this.opts.rememberUpgrade&&W.priorWebsocketSuccess&&this.transports.indexOf("websocket")!==-1?"websocket":this.transports[0];this.readyState="opening";const t=this.createTransport(e);t.open(),this.setTransport(t)}setTransport(e){this.transport&&this.transport.removeAllListeners(),this.transport=e,e.on("drain",this._onDrain.bind(this)).on("packet",this._onPacket.bind(this)).on("error",this._onError.bind(this)).on("close",t=>this._onClose("transport close",t))}onOpen(){this.readyState="open",W.priorWebsocketSuccess=this.transport.name==="websocket",this.emitReserved("open"),this.flush()}_onPacket(e){if(this.readyState==="opening"||this.readyState==="open"||this.readyState==="closing")switch(this.emitReserved("packet",e),this.emitReserved("heartbeat"),e.type){case"open":this.onHandshake(JSON.parse(e.data));break;case"ping":this._sendPacket("pong"),this.emitReserved("ping"),this.emitReserved("pong"),this._resetPingTimeout();break;case"error":const t=new Error("server error");t.code=e.data,this._onError(t);break;case"message":this.emitReserved("data",e.data),this.emitReserved("message",e.data);break}}onHandshake(e){this.emitReserved("handshake",e),this.id=e.sid,this.transport.query.sid=e.sid,this._pingInterval=e.pingInterval,this._pingTimeout=e.pingTimeout,this._maxPayload=e.maxPayload,this.onOpen(),this.readyState!=="closed"&&this._resetPingTimeout()}_resetPingTimeout(){this.clearTimeoutFn(this._pingTimeoutTimer);const e=this._pingInterval+this._pingTimeout;this._pingTimeoutTime=Date.now()+e,this._pingTimeoutTimer=this.setTimeoutFn(()=>{this._onClose("ping timeout")},e),this.opts.autoUnref&&this._pingTimeoutTimer.unref()}_onDrain(){this.writeBuffer.splice(0,this._prevBufferLen),this._prevBufferLen=0,this.writeBuffer.length===0?this.emitReserved("drain"):this.flush()}flush(){if(this.readyState!=="closed"&&this.transport.writable&&!this.upgrading&&this.writeBuffer.length){const e=this._getWritablePackets();this.transport.send(e),this._prevBufferLen=e.length,this.emitReserved("flush")}}_getWritablePackets(){if(!(this._maxPayload&&this.transport.name==="polling"&&this.writeBuffer.length>1))return this.writeBuffer;let t=1;for(let i=0;i<this.writeBuffer.length;i++){const s=this.writeBuffer[i].data;if(s&&(t+=on(s)),i>0&&t>this._maxPayload)return this.writeBuffer.slice(0,i);t+=2}return this.writeBuffer}_hasPingExpired(){if(!this._pingTimeoutTime)return!0;const e=Date.now()>this._pingTimeoutTime;return e&&(this._pingTimeoutTime=0,he(()=>{this._onClose("ping timeout")},this.setTimeoutFn)),e}write(e,t,i){return this._sendPacket("message",e,t,i),this}send(e,t,i){return this._sendPacket("message",e,t,i),this}_sendPacket(e,t,i,s){if(typeof t=="function"&&(s=t,t=void 0),typeof i=="function"&&(s=i,i=null),this.readyState==="closing"||this.readyState==="closed")return;i=i||{},i.compress=i.compress!==!1;const r={type:e,data:t,options:i};this.emitReserved("packetCreate",r),this.writeBuffer.push(r),s&&this.once("flush",s),this.flush()}close(){const e=()=>{this._onClose("forced close"),this.transport.close()},t=()=>{this.off("upgrade",t),this.off("upgradeError",t),e()},i=()=>{this.once("upgrade",t),this.once("upgradeError",t)};return(this.readyState==="opening"||this.readyState==="open")&&(this.readyState="closing",this.writeBuffer.length?this.once("drain",()=>{this.upgrading?i():e()}):this.upgrading?i():e()),this}_onError(e){if(W.priorWebsocketSuccess=!1,this.opts.tryAllTransports&&this.transports.length>1&&this.readyState==="opening")return this.transports.shift(),this._open();this.emitReserved("error",e),this._onClose("transport error",e)}_onClose(e,t){if(this.readyState==="opening"||this.readyState==="open"||this.readyState==="closing"){if(this.clearTimeoutFn(this._pingTimeoutTimer),this.transport.removeAllListeners("close"),this.transport.close(),this.transport.removeAllListeners(),Re&&(this._beforeunloadEventListener&&removeEventListener("beforeunload",this._beforeunloadEventListener,!1),this._offlineEventListener)){const i=ue.indexOf(this._offlineEventListener);i!==-1&&ue.splice(i,1)}this.readyState="closed",this.id=null,this.emitReserved("close",e,t),this.writeBuffer=[],this._prevBufferLen=0}}}W.protocol=tt;class En extends W{constructor(){super(...arguments),this._upgrades=[]}onOpen(){if(super.onOpen(),this.readyState==="open"&&this.opts.upgrade)for(let e=0;e<this._upgrades.length;e++)this._probe(this._upgrades[e])}_probe(e){let t=this.createTransport(e),i=!1;W.priorWebsocketSuccess=!1;const s=()=>{i||(t.send([{type:"ping",data:"probe"}]),t.once("packet",w=>{if(!i)if(w.type==="pong"&&w.data==="probe"){if(this.upgrading=!0,this.emitReserved("upgrading",t),!t)return;W.priorWebsocketSuccess=t.name==="websocket",this.transport.pause(()=>{i||this.readyState!=="closed"&&(x(),this.setTransport(t),t.send([{type:"upgrade"}]),this.emitReserved("upgrade",t),t=null,this.upgrading=!1,this.flush())})}else{const h=new Error("probe error");h.transport=t.name,this.emitReserved("upgradeError",h)}}))};function r(){i||(i=!0,x(),t.close(),t=null)}const o=w=>{const h=new Error("probe error: "+w);h.transport=t.name,r(),this.emitReserved("upgradeError",h)};function l(){o("transport closed")}function a(){o("socket closed")}function b(w){t&&w.name!==t.name&&r()}const x=()=>{t.removeListener("open",s),t.removeListener("error",o),t.removeListener("close",l),this.off("close",a),this.off("upgrading",b)};t.once("open",s),t.once("error",o),t.once("close",l),this.once("close",a),this.once("upgrading",b),this._upgrades.indexOf("webtransport")!==-1&&e!=="webtransport"?this.setTimeoutFn(()=>{i||t.open()},200):t.open()}onHandshake(e){this._upgrades=this._filterUpgrades(e.upgrades),super.onHandshake(e)}_filterUpgrades(e){const t=[];for(let i=0;i<e.length;i++)~this.transports.indexOf(e[i])&&t.push(e[i]);return t}}let Tn=class extends En{constructor(e,t={}){const i=typeof e=="object"?e:t;(!i.transports||i.transports&&typeof i.transports[0]=="string")&&(i.transports=(i.transports||["polling","websocket","webtransport"]).map(s=>vn[s]).filter(s=>!!s)),super(e,i)}};function An(n,e="",t){let i=n;t=t||typeof location!="undefined"&&location,n==null&&(n=t.protocol+"//"+t.host),typeof n=="string"&&(n.charAt(0)==="/"&&(n.charAt(1)==="/"?n=t.protocol+n:n=t.host+n),/^(https?|wss?):\/\//.test(n)||(typeof t!="undefined"?n=t.protocol+"//"+n:n="https://"+n),i=Le(n)),i.port||(/^(http|ws)$/.test(i.protocol)?i.port="80":/^(http|ws)s$/.test(i.protocol)&&(i.port="443")),i.path=i.path||"/";const r=i.host.indexOf(":")!==-1?"["+i.host+"]":i.host;return i.id=i.protocol+"://"+r+":"+i.port+e,i.href=i.protocol+"://"+r+(t&&t.port===i.port?"":":"+i.port),i}const In=typeof ArrayBuffer=="function",On=n=>typeof ArrayBuffer.isView=="function"?ArrayBuffer.isView(n):n.buffer instanceof ArrayBuffer,ct=Object.prototype.toString,Ln=typeof Blob=="function"||typeof Blob!="undefined"&&ct.call(Blob)==="[object BlobConstructor]",Rn=typeof File=="function"||typeof File!="undefined"&&ct.call(File)==="[object FileConstructor]";function Be(n){return In&&(n instanceof ArrayBuffer||On(n))||Ln&&n instanceof Blob||Rn&&n instanceof File}function fe(n,e){if(!n||typeof n!="object")return!1;if(Array.isArray(n)){for(let t=0,i=n.length;t<i;t++)if(fe(n[t]))return!0;return!1}if(Be(n))return!0;if(n.toJSON&&typeof n.toJSON=="function"&&arguments.length===1)return fe(n.toJSON(),!0);for(const t in n)if(Object.prototype.hasOwnProperty.call(n,t)&&fe(n[t]))return!0;return!1}function Bn(n){const e=[],t=n.data,i=n;return i.data=Ce(t,e),i.attachments=e.length,{packet:i,buffers:e}}function Ce(n,e){if(!n)return n;if(Be(n)){const t={_placeholder:!0,num:e.length};return e.push(n),t}else if(Array.isArray(n)){const t=new Array(n.length);for(let i=0;i<n.length;i++)t[i]=Ce(n[i],e);return t}else if(typeof n=="object"&&!(n instanceof Date)){const t={};for(const i in n)Object.prototype.hasOwnProperty.call(n,i)&&(t[i]=Ce(n[i],e));return t}return n}function Cn(n,e){return n.data=$e(n.data,e),delete n.attachments,n}function $e(n,e){if(!n)return n;if(n&&n._placeholder===!0){if(typeof n.num=="number"&&n.num>=0&&n.num<e.length)return e[n.num];throw new Error("illegal attachments")}else if(Array.isArray(n))for(let t=0;t<n.length;t++)n[t]=$e(n[t],e);else if(typeof n=="object")for(const t in n)Object.prototype.hasOwnProperty.call(n,t)&&(n[t]=$e(n[t],e));return n}const $n=["connect","connect_error","disconnect","disconnecting","newListener","removeListener"];var g;(function(n){n[n.CONNECT=0]="CONNECT",n[n.DISCONNECT=1]="DISCONNECT",n[n.EVENT=2]="EVENT",n[n.ACK=3]="ACK",n[n.CONNECT_ERROR=4]="CONNECT_ERROR",n[n.BINARY_EVENT=5]="BINARY_EVENT",n[n.BINARY_ACK=6]="BINARY_ACK"})(g||(g={}));class Nn{constructor(e){this.replacer=e}encode(e){return(e.type===g.EVENT||e.type===g.ACK)&&fe(e)?this.encodeAsBinary({type:e.type===g.EVENT?g.BINARY_EVENT:g.BINARY_ACK,nsp:e.nsp,data:e.data,id:e.id}):[this.encodeAsString(e)]}encodeAsString(e){let t=""+e.type;return(e.type===g.BINARY_EVENT||e.type===g.BINARY_ACK)&&(t+=e.attachments+"-"),e.nsp&&e.nsp!=="/"&&(t+=e.nsp+","),e.id!=null&&(t+=e.id),e.data!=null&&(t+=JSON.stringify(e.data,this.replacer)),t}encodeAsBinary(e){const t=Bn(e),i=this.encodeAsString(t.packet),s=t.buffers;return s.unshift(i),s}}class Ne extends T{constructor(e){super(),this.opts=Object.assign({reviver:void 0,maxAttachments:10},typeof e=="function"?{reviver:e}:e)}add(e){let t;if(typeof e=="string"){if(this.reconstructor)throw new Error("got plaintext data when reconstructing a packet");t=this.decodeString(e);const i=t.type===g.BINARY_EVENT;i||t.type===g.BINARY_ACK?(t.type=i?g.EVENT:g.ACK,this.reconstructor=new qn(t),t.attachments===0&&super.emitReserved("decoded",t)):super.emitReserved("decoded",t)}else if(Be(e)||e.base64)if(this.reconstructor)t=this.reconstructor.takeBinaryData(e),t&&(this.reconstructor=null,super.emitReserved("decoded",t));else throw new Error("got binary data when not reconstructing a packet");else throw new Error("Unknown type: "+e)}decodeString(e){let t=0;const i={type:Number(e.charAt(0))};if(g[i.type]===void 0)throw new Error("unknown packet type "+i.type);if(i.type===g.BINARY_EVENT||i.type===g.BINARY_ACK){const r=t+1;for(;e.charAt(++t)!=="-"&&t!=e.length;);const o=e.substring(r,t);if(o!=Number(o)||e.charAt(t)!=="-")throw new Error("Illegal attachments");const l=Number(o);if(!Mn(l)||l<0)throw new Error("Illegal attachments");if(l>this.opts.maxAttachments)throw new Error("too many attachments");i.attachments=l}if(e.charAt(t+1)==="/"){const r=t+1;for(;++t&&!(e.charAt(t)===","||t===e.length););i.nsp=e.substring(r,t)}else i.nsp="/";const s=e.charAt(t+1);if(s!==""&&Number(s)==s){const r=t+1;for(;++t;){const o=e.charAt(t);if(o==null||Number(o)!=o){--t;break}if(t===e.length)break}i.id=Number(e.substring(r,t+1))}if(e.charAt(++t)){const r=this.tryParse(e.substr(t));if(Ne.isPayloadValid(i.type,r))i.data=r;else throw new Error("invalid payload")}return i}tryParse(e){try{return JSON.parse(e,this.opts.reviver)}catch(t){return!1}}static isPayloadValid(e,t){switch(e){case g.CONNECT:return lt(t);case g.DISCONNECT:return t===void 0;case g.CONNECT_ERROR:return typeof t=="string"||lt(t);case g.EVENT:case g.BINARY_EVENT:return Array.isArray(t)&&(typeof t[0]=="number"||typeof t[0]=="string"&&$n.indexOf(t[0])===-1);case g.ACK:case g.BINARY_ACK:return Array.isArray(t)}}destroy(){this.reconstructor&&(this.reconstructor.finishedReconstruction(),this.reconstructor=null)}}class qn{constructor(e){this.packet=e,this.buffers=[],this.reconPack=e}takeBinaryData(e){if(this.buffers.push(e),this.buffers.length===this.reconPack.attachments){const t=Cn(this.reconPack,this.buffers);return this.finishedReconstruction(),t}return null}finishedReconstruction(){this.reconPack=null,this.buffers=[]}}const Mn=Number.isInteger||function(n){return typeof n=="number"&&isFinite(n)&&Math.floor(n)===n};function lt(n){return Object.prototype.toString.call(n)==="[object Object]"}const Dn=Object.freeze(Object.defineProperty({__proto__:null,Decoder:Ne,Encoder:Nn,get PacketType(){return g}},Symbol.toStringTag,{value:"Module"}));function P(n,e,t){return n.on(e,t),function(){n.off(e,t)}}const Pn=Object.freeze({connect:1,connect_error:1,disconnect:1,disconnecting:1,newListener:1,removeListener:1});class dt extends T{constructor(e,t,i){super(),this.connected=!1,this.recovered=!1,this.receiveBuffer=[],this.sendBuffer=[],this._queue=[],this._queueSeq=0,this.ids=0,this.acks={},this.flags={},this.io=e,this.nsp=t,i&&i.auth&&(this.auth=i.auth),this._opts=Object.assign({},i),this.io._autoConnect&&this.open()}get disconnected(){return!this.connected}subEvents(){if(this.subs)return;const e=this.io;this.subs=[P(e,"open",this.onopen.bind(this)),P(e,"packet",this.onpacket.bind(this)),P(e,"error",this.onerror.bind(this)),P(e,"close",this.onclose.bind(this))]}get active(){return!!this.subs}connect(){return this.connected?this:(this.subEvents(),this.io._reconnecting||this.io.open(),this.io._readyState==="open"&&this.onopen(),this)}open(){return this.connect()}send(...e){return e.unshift("message"),this.emit.apply(this,e),this}emit(e,...t){var i,s,r;if(Pn.hasOwnProperty(e))throw new Error('"'+e.toString()+'" is a reserved event name');if(t.unshift(e),this._opts.retries&&!this.flags.fromQueue&&!this.flags.volatile)return this._addToQueue(t),this;const o={type:g.EVENT,data:t};if(o.options={},o.options.compress=this.flags.compress!==!1,typeof t[t.length-1]=="function"){const x=this.ids++,w=t.pop();this._registerAckCallback(x,w),o.id=x}const l=(s=(i=this.io.engine)===null||i===void 0?void 0:i.transport)===null||s===void 0?void 0:s.writable,a=this.connected&&!(!((r=this.io.engine)===null||r===void 0)&&r._hasPingExpired());return this.flags.volatile&&!l||(a?(this.notifyOutgoingListeners(o),this.packet(o)):this.sendBuffer.push(o)),this.flags={},this}_registerAckCallback(e,t){var i;const s=(i=this.flags.timeout)!==null&&i!==void 0?i:this._opts.ackTimeout;if(s===void 0){this.acks[e]=t;return}const r=this.io.setTimeoutFn(()=>{delete this.acks[e];for(let l=0;l<this.sendBuffer.length;l++)this.sendBuffer[l].id===e&&this.sendBuffer.splice(l,1);t.call(this,new Error("operation has timed out"))},s),o=(...l)=>{this.io.clearTimeoutFn(r),t.apply(this,l)};o.withError=!0,this.acks[e]=o}emitWithAck(e,...t){return new Promise((i,s)=>{const r=(o,l)=>o?s(o):i(l);r.withError=!0,t.push(r),this.emit(e,...t)})}_addToQueue(e){let t;typeof e[e.length-1]=="function"&&(t=e.pop());const i={id:this._queueSeq++,tryCount:0,pending:!1,args:e,flags:Object.assign({fromQueue:!0},this.flags)};e.push((s,...r)=>(this._queue[0],s!==null?i.tryCount>this._opts.retries&&(this._queue.shift(),t&&t(s)):(this._queue.shift(),t&&t(null,...r)),i.pending=!1,this._drainQueue())),this._queue.push(i),this._drainQueue()}_drainQueue(e=!1){if(!this.connected||this._queue.length===0)return;const t=this._queue[0];t.pending&&!e||(t.pending=!0,t.tryCount++,this.flags=t.flags,this.emit.apply(this,t.args))}packet(e){e.nsp=this.nsp,this.io._packet(e)}onopen(){typeof this.auth=="function"?this.auth(e=>{this._sendConnectPacket(e)}):this._sendConnectPacket(this.auth)}_sendConnectPacket(e){this.packet({type:g.CONNECT,data:this._pid?Object.assign({pid:this._pid,offset:this._lastOffset},e):e})}onerror(e){this.connected||this.emitReserved("connect_error",e)}onclose(e,t){this.connected=!1,delete this.id,this.emitReserved("disconnect",e,t),this._clearAcks()}_clearAcks(){Object.keys(this.acks).forEach(e=>{if(!this.sendBuffer.some(i=>String(i.id)===e)){const i=this.acks[e];delete this.acks[e],i.withError&&i.call(this,new Error("socket has been disconnected"))}})}onpacket(e){if(e.nsp===this.nsp)switch(e.type){case g.CONNECT:e.data&&e.data.sid?this.onconnect(e.data.sid,e.data.pid):this.emitReserved("connect_error",new Error("It seems you are trying to reach a Socket.IO server in v2.x with a v3.x client, but they are not compatible (more information here: https://socket.io/docs/v3/migrating-from-2-x-to-3-0/)"));break;case g.EVENT:case g.BINARY_EVENT:this.onevent(e);break;case g.ACK:case g.BINARY_ACK:this.onack(e);break;case g.DISCONNECT:this.ondisconnect();break;case g.CONNECT_ERROR:this.destroy();const i=new Error(e.data.message);i.data=e.data.data,this.emitReserved("connect_error",i);break}}onevent(e){const t=e.data||[];e.id!=null&&t.push(this.ack(e.id)),this.connected?this.emitEvent(t):this.receiveBuffer.push(Object.freeze(t))}emitEvent(e){if(this._anyListeners&&this._anyListeners.length){const t=this._anyListeners.slice();for(const i of t)i.apply(this,e)}super.emit.apply(this,e),this._pid&&e.length&&typeof e[e.length-1]=="string"&&(this._lastOffset=e[e.length-1])}ack(e){const t=this;let i=!1;return function(...s){i||(i=!0,t.packet({type:g.ACK,id:e,data:s}))}}onack(e){const t=this.acks[e.id];typeof t=="function"&&(delete this.acks[e.id],t.withError&&e.data.unshift(null),t.apply(this,e.data))}onconnect(e,t){this.id=e,this.recovered=t&&this._pid===t,this._pid=t,this.connected=!0,this.emitBuffered(),this._drainQueue(!0),this.emitReserved("connect")}emitBuffered(){this.receiveBuffer.forEach(e=>this.emitEvent(e)),this.receiveBuffer=[],this.sendBuffer.forEach(e=>{this.notifyOutgoingListeners(e),this.packet(e)}),this.sendBuffer=[]}ondisconnect(){this.destroy(),this.onclose("io server disconnect")}destroy(){this.subs&&(this.subs.forEach(e=>e()),this.subs=void 0),this.io._destroy(this)}disconnect(){return this.connected&&this.packet({type:g.DISCONNECT}),this.destroy(),this.connected&&this.onclose("io client disconnect"),this}close(){return this.disconnect()}compress(e){return this.flags.compress=e,this}get volatile(){return this.flags.volatile=!0,this}timeout(e){return this.flags.timeout=e,this}onAny(e){return this._anyListeners=this._anyListeners||[],this._anyListeners.push(e),this}prependAny(e){return this._anyListeners=this._anyListeners||[],this._anyListeners.unshift(e),this}offAny(e){if(!this._anyListeners)return this;if(e){const t=this._anyListeners;for(let i=0;i<t.length;i++)if(e===t[i])return t.splice(i,1),this}else this._anyListeners=[];return this}listenersAny(){return this._anyListeners||[]}onAnyOutgoing(e){return this._anyOutgoingListeners=this._anyOutgoingListeners||[],this._anyOutgoingListeners.push(e),this}prependAnyOutgoing(e){return this._anyOutgoingListeners=this._anyOutgoingListeners||[],this._anyOutgoingListeners.unshift(e),this}offAnyOutgoing(e){if(!this._anyOutgoingListeners)return this;if(e){const t=this._anyOutgoingListeners;for(let i=0;i<t.length;i++)if(e===t[i])return t.splice(i,1),this}else this._anyOutgoingListeners=[];return this}listenersAnyOutgoing(){return this._anyOutgoingListeners||[]}notifyOutgoingListeners(e){if(this._anyOutgoingListeners&&this._anyOutgoingListeners.length){const t=this._anyOutgoingListeners.slice();for(const i of t)i.apply(this,e.data)}}}function Z(n){n=n||{},this.ms=n.min||100,this.max=n.max||1e4,this.factor=n.factor||2,this.jitter=n.jitter>0&&n.jitter<=1?n.jitter:0,this.attempts=0}Z.prototype.duration=function(){var n=this.ms*Math.pow(this.factor,this.attempts++);if(this.jitter){var e=Math.random(),t=Math.floor(e*this.jitter*n);n=(Math.floor(e*10)&1)==0?n-t:n+t}return Math.min(n,this.max)|0},Z.prototype.reset=function(){this.attempts=0},Z.prototype.setMin=function(n){this.ms=n},Z.prototype.setMax=function(n){this.max=n},Z.prototype.setJitter=function(n){this.jitter=n};class qe extends T{constructor(e,t){var i;super(),this.nsps={},this.subs=[],e&&typeof e=="object"&&(t=e,e=void 0),t=t||{},t.path=t.path||"/socket.io",this.opts=t,pe(this,t),this.reconnection(t.reconnection!==!1),this.reconnectionAttempts(t.reconnectionAttempts||1/0),this.reconnectionDelay(t.reconnectionDelay||1e3),this.reconnectionDelayMax(t.reconnectionDelayMax||5e3),this.randomizationFactor((i=t.randomizationFactor)!==null&&i!==void 0?i:.5),this.backoff=new Z({min:this.reconnectionDelay(),max:this.reconnectionDelayMax(),jitter:this.randomizationFactor()}),this.timeout(t.timeout==null?2e4:t.timeout),this._readyState="closed",this.uri=e;const s=t.parser||Dn;this.encoder=new s.Encoder,this.decoder=new s.Decoder,this._autoConnect=t.autoConnect!==!1,this._autoConnect&&this.open()}reconnection(e){return arguments.length?(this._reconnection=!!e,e||(this.skipReconnect=!0),this):this._reconnection}reconnectionAttempts(e){return e===void 0?this._reconnectionAttempts:(this._reconnectionAttempts=e,this)}reconnectionDelay(e){var t;return e===void 0?this._reconnectionDelay:(this._reconnectionDelay=e,(t=this.backoff)===null||t===void 0||t.setMin(e),this)}randomizationFactor(e){var t;return e===void 0?this._randomizationFactor:(this._randomizationFactor=e,(t=this.backoff)===null||t===void 0||t.setJitter(e),this)}reconnectionDelayMax(e){var t;return e===void 0?this._reconnectionDelayMax:(this._reconnectionDelayMax=e,(t=this.backoff)===null||t===void 0||t.setMax(e),this)}timeout(e){return arguments.length?(this._timeout=e,this):this._timeout}maybeReconnectOnOpen(){!this._reconnecting&&this._reconnection&&this.backoff.attempts===0&&this.reconnect()}open(e){if(~this._readyState.indexOf("open"))return this;this.engine=new Tn(this.uri,this.opts);const t=this.engine,i=this;this._readyState="opening",this.skipReconnect=!1;const s=P(t,"open",function(){i.onopen(),e&&e()}),r=l=>{this.cleanup(),this._readyState="closed",this.emitReserved("error",l),e?e(l):this.maybeReconnectOnOpen()},o=P(t,"error",r);if(this._timeout!==!1){const l=this._timeout,a=this.setTimeoutFn(()=>{s(),r(new Error("timeout")),t.close()},l);this.opts.autoUnref&&a.unref(),this.subs.push(()=>{this.clearTimeoutFn(a)})}return this.subs.push(s),this.subs.push(o),this}connect(e){return this.open(e)}onopen(){this.cleanup(),this._readyState="open",this.emitReserved("open");const e=this.engine;this.subs.push(P(e,"ping",this.onping.bind(this)),P(e,"data",this.ondata.bind(this)),P(e,"error",this.onerror.bind(this)),P(e,"close",this.onclose.bind(this)),P(this.decoder,"decoded",this.ondecoded.bind(this)))}onping(){this.emitReserved("ping")}ondata(e){try{this.decoder.add(e)}catch(t){this.onclose("parse error",t)}}ondecoded(e){he(()=>{this.emitReserved("packet",e)},this.setTimeoutFn)}onerror(e){this.emitReserved("error",e)}socket(e,t){let i=this.nsps[e];return i?this._autoConnect&&!i.active&&i.connect():(i=new dt(this,e,t),this.nsps[e]=i),i}_destroy(e){const t=Object.keys(this.nsps);for(const i of t)if(this.nsps[i].active)return;this._close()}_packet(e){const t=this.encoder.encode(e);for(let i=0;i<t.length;i++)this.engine.write(t[i],e.options)}cleanup(){this.subs.forEach(e=>e()),this.subs.length=0,this.decoder.destroy()}_close(){this.skipReconnect=!0,this._reconnecting=!1,this.onclose("forced close")}disconnect(){return this._close()}onclose(e,t){var i;this.cleanup(),(i=this.engine)===null||i===void 0||i.close(),this.backoff.reset(),this._readyState="closed",this.emitReserved("close",e,t),this._reconnection&&!this.skipReconnect&&this.reconnect()}reconnect(){if(this._reconnecting||this.skipReconnect)return this;const e=this;if(this.backoff.attempts>=this._reconnectionAttempts)this.backoff.reset(),this.emitReserved("reconnect_failed"),this._reconnecting=!1;else{const t=this.backoff.duration();this._reconnecting=!0;const i=this.setTimeoutFn(()=>{e.skipReconnect||(this.emitReserved("reconnect_attempt",e.backoff.attempts),!e.skipReconnect&&e.open(s=>{s?(e._reconnecting=!1,e.reconnect(),this.emitReserved("reconnect_error",s)):e.onreconnect()}))},t);this.opts.autoUnref&&i.unref(),this.subs.push(()=>{this.clearTimeoutFn(i)})}}onreconnect(){const e=this.backoff.attempts;this._reconnecting=!1,this.backoff.reset(),this.emitReserved("reconnect",e)}}const se={};function me(n,e){typeof n=="object"&&(e=n,n=void 0),e=e||{};const t=An(n,e.path||"/socket.io"),i=t.source,s=t.id,r=t.path,o=se[s]&&r in se[s].nsps,l=e.forceNew||e["force new connection"]||e.multiplex===!1||o;let a;return l?a=new qe(i,e):(se[s]||(se[s]=new qe(i,e)),a=se[s]),t.query&&!e.query&&(e.query=t.queryKey),a.socket(t.path,e)}Object.assign(me,{Manager:qe,Socket:dt,io:me,connect:me});function jn(n,e,t){const i=n.apiBase||window.location.origin,s=me(i,{path:"/livechat-ws",auth:{siteKey:n.siteKey,visitorId:n.visitorId,sessionId:e},transports:["websocket","polling"],reconnection:!0,reconnectionDelay:600,reconnectionDelayMax:8e3});return s.on("livechat:event",r=>{r.sessionId===e&&t(r)}),s}const zn=`
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
  flex-direction: column;
  flex-shrink: 0;
}
.lc-header-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; width: 100%; }
.lc-header-inner { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; }
.lc-header-sub-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 12px;
  opacity: 0.9;
  color: #fff;
}
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

/* ── Proactive welcome bubble ── */
/* Styled as a chat bubble pointing down at the chat-launcher button.
   Width is fixed (not max-width) because the host has no intrinsic width;
   without an explicit width the bubble shrinks to longest-word size. */
.lc-proactive {
  position: absolute;
  bottom: 76px;
  right: 0;
  width: 280px;
  max-width: calc(100vw - 80px);
  background: #fff;
  border-radius: 18px 18px 4px 18px;
  box-shadow: 0 10px 32px rgba(15, 23, 42, 0.18), 0 2px 8px rgba(15, 23, 42, 0.08);
  padding: 14px 18px 14px 16px;
  font-size: 14px;
  color: #1f2937;
  line-height: 1.5;
  animation: lc-slide-in 0.3s ease;
}
:host(.lc-position-left) .lc-proactive {
  right: auto;
  left: 0;
  border-radius: 18px 18px 18px 4px;
}
.lc-proactive-text { cursor: pointer; padding-right: 18px; }
.lc-proactive-text:hover { text-decoration: none; }
.lc-proactive-close {
  position: absolute;
  top: 8px;
  right: 8px;
  background: transparent;
  border: 0;
  color: #9ca3af;
  font-size: 14px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  border-radius: 50%;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
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
`,Me=[{name:"Smileys",emojis:["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","😐","😑","😶","🙄","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🤐","🤨","😐","😑","😶","😏","😴","🤤","😪","😵","🤐","🥴","🤢","🤮","🤧","😷"]},{name:"Hearts",emojis:["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟"]},{name:"Hands",emojis:["👍","👎","👌","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","👋","🤚","🖐️","✋","🖖","👏","🙌","🤝","🙏","✍️","💪","🦾"]},{name:"Objects",emojis:["🔥","✨","🎉","🎊","🎁","🏆","🥇","⭐","🌟","💫","💥","💯","✅","❌","⚠️","❓","❗","💡","📌","📎","🔗","🔒","🔑","⏰","⏳","📅","📆","🗓️","📊","📈"]},{name:"Travel",emojis:["🚀","✈️","🚗","🚕","🚙","🚌","🏠","🏢","🏥","🏦","🏪","🏫","⛺","🌍","🌎","🌏","🗺️","🏖️","🏔️","🌋"]}],Un=[[":)","🙂"],[":-)","🙂"],[":D","😄"],[":-D","😄"],["xD","😆"],["XD","😆"],[":P","😛"],[":p","😋"],[":-P","😛"],[":'(","😢"],[":(","🙁"],[":-(","🙁"],[";)","😉"],[";-)","😉"],[":O","😮"],[":o","😮"],[":-O","😮"],[":oO","😳"],[":|","😐"],[":-|","😐"],[":/","😕"],[":-/","😕"],["<3","❤️"],["</3","💔"],[":*","😘"],["B)","😎"]];function Hn(n){let e=n;for(const[t,i]of Un){const s=t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),r=new RegExp(`(^|\\s)${s}(?=\\s|$|[.,!?])`,"g");e=e.replace(r,`$1${i}`)}return e}const Fn="https://gist.githubusercontent.com/Sharifur/b40c7b54b97d43f353f1382e51c70535/raw/f6446fa378bf266cacf604f1e97f8f318e01e157/temporary-email-address-domain-list.json",ht="livechat_disposable_domains",pt="livechat_disposable_domains_ts",Kn=1440*60*1e3;let J=null;async function ut(){if(J)return J;try{const n=localStorage.getItem(pt),e=localStorage.getItem(ht),t=n?Number(n):0;if(e&&t&&Date.now()-t<Kn){const i=JSON.parse(e);return J=new Set(i.map(s=>s.toLowerCase())),J}}catch(n){}try{const n=new AbortController,e=setTimeout(()=>n.abort(),4e3),t=await fetch(Fn,{signal:n.signal});if(clearTimeout(e),t.ok){const i=await t.json(),r=(Array.isArray(i)?i:[]).map(o=>String(o).trim().toLowerCase()).filter(Boolean);J=new Set(r);try{localStorage.setItem(ht,JSON.stringify(r)),localStorage.setItem(pt,String(Date.now()))}catch(o){}return J}}catch(n){}return J=new Set(["mailinator.com","guerrillamail.com","10minutemail.com","tempmail.com","temp-mail.org","yopmail.com","trashmail.com","fakeinbox.com","throwawaymail.com","getairmail.com","sharklasers.com"]),J}async function Vn(n){const e=n.lastIndexOf("@");if(e<0)return!1;const t=n.slice(e+1).trim().toLowerCase();return t?(await ut()).has(t):!1}function Yn(){ut()}const Wn={siteKey:"",botName:"Hi there",botSubtitle:"We typically reply in a few seconds.",welcomeMessage:null,brandColor:"#2563eb",position:"bottom-right"},De="livechat_messages_cache",Pe="livechat_session_id",je="livechat_identify_dismissed",ge="livechat_identify_name",ze="livechat_identify_email",ft="livechat_send_log",ye="livechat_proactive_seen",Jn=30,Xn=6e4,Gn=3;function Qn(n,e=Wn){var U,f;const t=document.createElement("div");t.id="livechat-widget-root",t.style.cssText="position: fixed; bottom: 40px; right: 40px; z-index: 2147483646;",document.body.appendChild(t);const i=t.attachShadow({mode:"open"}),s=(U=ci(e.brandColor))!=null?U:"#2563eb",r=vt(s,.35),o=vt(s,.45);t.style.setProperty("--lc-brand",s),t.style.setProperty("--lc-brand-shadow",r),t.style.setProperty("--lc-brand-shadow-hover",o),e.position==="bottom-left"&&t.classList.add("lc-position-left");const l=document.createElement("style");l.textContent=zn,i.appendChild(l);const a={open:!1,sessionId:ri(),messages:ai(),socket:null,panel:null,askedForEmail:!1,askedForName:!1,knownName:ni(),unread:0,sessionClosed:!1,feedbackAsked:!1,operators:(f=e.operators)!=null?f:[],host:t,cfg:n},b=document.createElement("button");b.className="lc-bubble",b.innerHTML=gi(),i.appendChild(b);const x=document.createElement("span");x.className="lc-unread",x.style.display="none",b.appendChild(x);const w=document.createElement("div");if(w.className="lc-proactive",w.style.display="none",e.welcomeMessage){w.innerHTML=`
      <button class="lc-proactive-close" aria-label="Dismiss">&#x2715;</button>
      <div class="lc-proactive-text">${A(e.welcomeMessage)}</div>
    `,i.appendChild(w);let v=!1;try{v=!!sessionStorage.getItem(ye)}catch(M){}v||setTimeout(()=>{a.open||(w.style.display="block")},1500),w.querySelector(".lc-proactive-close").addEventListener("click",M=>{M.stopPropagation(),w.style.display="none";try{sessionStorage.setItem(ye,"1")}catch(Y){}}),w.querySelector(".lc-proactive-text").addEventListener("click",()=>{w.style.display="none";try{sessionStorage.setItem(ye,"1")}catch(M){}b.click()})}a.messages.length===0&&e.welcomeMessage&&(a.messages.push({id:"welcome",role:"agent",content:e.welcomeMessage,createdAt:new Date().toISOString()}),ee(a.messages));const h=Zn(i,n,a,z,e);h.style.display="none",a.panel=h,h._state=a,h._cfg=n;const R=()=>window.innerWidth<=480,B="position: fixed; bottom: 40px; right: 40px; z-index: 2147483646;";function k(){const v=window.visualViewport;v?t.style.cssText=`position: fixed; top: ${v.offsetTop}px; left: ${v.offsetLeft}px; width: ${v.width}px; height: ${v.height}px; z-index: 2147483646;`:t.style.cssText="position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 2147483646;"}let $=!1;function y(){if($||!window.visualViewport)return;$=!0;const v=()=>{a.open&&(R()?k():t.style.cssText=B)};window.visualViewport.addEventListener("resize",v),window.visualViewport.addEventListener("scroll",v)}b.addEventListener("click",()=>{w.style.display="none";try{sessionStorage.setItem(ye,"1")}catch(v){}if(a.open=!a.open,a.open){R()&&(k(),y()),h.classList.remove("lc-panel--closing"),h.style.display="flex",a.unread=0,x.style.display="none";const v=h.querySelector("textarea");v==null||v.focus(),gt(h)}else h.classList.add("lc-panel--closing"),setTimeout(()=>{a.open||(h.style.display="none",R()&&(t.style.cssText=B)),h.classList.remove("lc-panel--closing")},180)}),a.sessionId&&mt(n,a,z,e),Yn();function z(){ei(h,a),!a.open&&a.unread>0?(x.textContent=String(Math.min(a.unread,99)),x.style.display="flex"):x.style.display="none"}z()}function Zn(n,e,t,i,s){var qt,Mt,Dt,Pt;const r=document.createElement("div");r.className="lc-panel";const l=((qt=s.operators)!=null?qt:[]).length>1?((Mt=s.botName)==null?void 0:Mt.trim())||s.operatorName||"Chat with us":((Dt=s.operatorName)==null?void 0:Dt.trim())||s.botName;r.innerHTML=`
    <div class="lc-header">
      <div class="lc-header-top">
        <div class="lc-header-inner">
          ${ki((Pt=s.operators)!=null?Pt:[],s.operatorName)}
          <div class="lc-header-text">
            <div class="lc-header-title">${A(l)}</div>
          </div>
        </div>
        <div class="lc-header-actions">
          <button class="lc-newchat-btn" aria-label="Start new conversation">${_i()}</button>
          <button class="lc-menu-btn" aria-label="Conversation menu" aria-haspopup="true">${bi()}</button>
          <div class="lc-menu" role="menu" style="display:none;">
            <button class="lc-menu-item" data-action="new">${xi()} Start a new conversation</button>
            <button class="lc-menu-item" data-action="close">${vi()} End this chat</button>
          </div>
          <button class="lc-close" aria-label="Close">${wt()}</button>
        </div>
      </div>
      <div class="lc-header-sub-row">
        <span class="lc-online-dot"></span>${A(s.botSubtitle)}
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
      <button type="button" class="lc-attach-btn" aria-label="Attach file">${fi()}</button>
      <button type="button" class="lc-emoji-btn" aria-label="Insert emoji">${wi()}</button>
      <div class="lc-emoji-pop" style="display:none;" role="dialog" aria-label="Emoji picker">
        <div class="lc-emoji-tabs">${Me.map((c,d)=>`<button type="button" class="lc-emoji-tab${d===0?" lc-emoji-tab-active":""}" data-cat="${d}">${c.name}</button>`).join("")}</div>
        <div class="lc-emoji-grid">${Me[0].emojis.map(c=>`<button type="button" class="lc-emoji-pick" data-emoji="${c}">${c}</button>`).join("")}</div>
      </div>
      <textarea placeholder="Type your message…" rows="1"></textarea>
      <button type="submit" aria-label="Send">${_t()}</button>
    </form>
  `,n.appendChild(r);const a="position: fixed; bottom: 40px; right: 40px; z-index: 2147483646;";r.querySelector(".lc-newchat-btn").addEventListener("click",()=>{confirm("Start a new conversation? The current chat will be cleared.")&&we()}),r.querySelector(".lc-close").addEventListener("click",()=>{t.open=!1,r.classList.add("lc-panel--closing"),setTimeout(()=>{t.open||(r.style.display="none",window.innerWidth<=480&&(t.host.style.cssText=a)),r.classList.remove("lc-panel--closing")},180)});const w=r.querySelector(".lc-menu-btn"),h=r.querySelector(".lc-menu"),R=()=>{h.style.display="none"};w.addEventListener("click",c=>{c.stopPropagation(),h.style.display=h.style.display==="none"?"block":"none"}),r.addEventListener("click",c=>{!h.contains(c.target)&&c.target!==w&&R()}),h.addEventListener("click",async c=>{const d=c.target.closest(".lc-menu-item");if(!d)return;R();const p=d.getAttribute("data-action");if(p==="new"){if(!confirm("Start a new conversation? The current chat will be cleared."))return;we()}else if(p==="close"){if(!confirm("End this chat? You can always start a new one."))return;const _=t.sessionId;if(_)try{await fetch(`${e.apiBase}/livechat/session/${encodeURIComponent(_)}/close`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({siteKey:e.siteKey,visitorId:e.visitorId}),credentials:"omit"})}catch(u){}we(),t.messages=[{id:`system-${Date.now()}`,role:"system",content:"Chat ended. Type a message to start a new conversation.",createdAt:new Date().toISOString()}],ee(t.messages),i()}});const B=r.querySelector(".lc-messages"),k=r.querySelector(".lc-scroll-btn");B.addEventListener("scroll",()=>{const c=B.scrollHeight-B.scrollTop-B.clientHeight;k.style.display=c>120?"flex":"none"}),k.addEventListener("click",()=>{B.scrollTop=B.scrollHeight,k.style.display="none"});const $=r.querySelector(".lc-composer"),y=r.querySelector("textarea"),z=r.querySelector(".lc-hp"),U=r.querySelector('.lc-composer button[type="submit"]'),f=r.querySelector(".lc-attach-btn"),v=r.querySelector(".lc-file-input"),M=r.querySelector(".lc-pending"),Y=r.querySelector(".lc-quick-replies"),xe=r.querySelector(".lc-session-end"),$i=r.querySelector(".lc-session-end-btn"),Ot=r.querySelector(".lc-emoji-btn"),ve=r.querySelector(".lc-emoji-pop"),Lt=r.querySelector(".lc-emoji-tabs"),Rt=r.querySelector(".lc-emoji-grid");function Ni(c){var u,m;const d=(u=y.selectionStart)!=null?u:y.value.length,p=(m=y.selectionEnd)!=null?m:d;y.value=y.value.slice(0,d)+c+y.value.slice(p);const _=d+c.length;y.setSelectionRange(_,_),y.focus()}function qi(c){const d=Me[c];d&&(Rt.innerHTML=d.emojis.map(p=>`<button type="button" class="lc-emoji-pick" data-emoji="${p}">${p}</button>`).join(""))}Ot.addEventListener("click",c=>{c.stopPropagation(),ve.style.display=ve.style.display==="none"?"block":"none"}),r.addEventListener("click",c=>{c.target instanceof Node&&!ve.contains(c.target)&&c.target!==Ot&&(ve.style.display="none")}),Lt.addEventListener("click",c=>{var p;const d=c.target.closest(".lc-emoji-tab");d&&(Lt.querySelectorAll(".lc-emoji-tab").forEach(_=>_.classList.remove("lc-emoji-tab-active")),d.classList.add("lc-emoji-tab-active"),qi(Number((p=d.getAttribute("data-cat"))!=null?p:0)))}),Rt.addEventListener("click",c=>{var p;const d=c.target.closest(".lc-emoji-pick");d&&Ni((p=d.getAttribute("data-emoji"))!=null?p:"")}),y.addEventListener("input",()=>{var p;const c=y.value,d=Hn(c);if(d!==c){const _=d.length-c.length,u=((p=y.selectionStart)!=null?p:c.length)+_;y.value=d,y.setSelectionRange(u,u)}});function we(){var c;(c=t.socket)==null||c.disconnect(),t.socket=null,t.sessionId=null,t.sessionClosed=!1,t.messages=[],t.askedForEmail=!1,t.unread=0;try{localStorage.removeItem(Pe)}catch(d){}try{localStorage.removeItem(De)}catch(d){}try{localStorage.removeItem(je)}catch(d){}xe.style.display="none",y.disabled=!1,U.disabled=!1,f.disabled=!1,s!=null&&s.welcomeMessage&&(t.messages.push({id:"welcome",role:"agent",content:s.welcomeMessage,createdAt:new Date().toISOString()}),ee(t.messages)),i()}$i.addEventListener("click",we);const I=[],Mi=Date.now();let _e=!1;y.addEventListener("keydown",()=>{_e=!0}),y.addEventListener("input",()=>{_e=!0});function Bt(c){y.value=c,_e=!0,$.requestSubmit()}r._submitFromChip=Bt;const Ct=()=>{var _;const c=t.messages.some(u=>u.role==="visitor"),d=/\b(talk|speak|connect|chat)\b.*\b(human|agent|person|representative|support team)\b|\b(human|live agent|real person)\b/i,p=((_=s.welcomeQuickReplies)!=null?_:[]).filter(Boolean).filter(u=>!d.test(u));if(c||p.length===0){Y.style.display="none",Y.innerHTML="";return}Y.style.display="flex",Y.innerHTML=p.map((u,m)=>`<button data-i="${m}" type="button">${A(u)}</button>`).join(""),Y.querySelectorAll("button").forEach(u=>{u.addEventListener("click",()=>{const m=Number(u.dataset.i),S=p[m];S&&Bt(S)})})};f.addEventListener("click",()=>v.click()),v.addEventListener("change",async()=>{var _;const c=(_=v.files)==null?void 0:_[0];if(v.value="",!c)return;if(c.size>10*1024*1024){j(r,`File too large: ${c.name} (max 10 MB)`);return}if(I.length>=5){j(r,"You can attach up to 5 files per message.");return}if(!t.sessionId){j(r,"Send a message first, then attach files.");return}const d=c.type.startsWith("image/")?URL.createObjectURL(c):void 0,p={id:"pending-"+Date.now(),mimeType:c.type,sizeBytes:c.size,originalFilename:c.name,url:"",localUrl:d};I.push(p),X();try{const u=await O(e,t.sessionId,c),m=I.indexOf(p);m>=0&&(I[m]=ne(Q({},u),{localUrl:d})),X()}catch(u){const m=I.indexOf(p);m>=0&&I.splice(m,1),d&&URL.revokeObjectURL(d),j(r,`Upload failed: ${u.message}`),X()}});function X(){if(!I.length){M.style.display="none",M.innerHTML="";return}M.style.display="flex",M.innerHTML=I.map((c,d)=>{var E;const p=c.id.startsWith("pending-"),_=(E=c.localUrl)!=null?E:"",m=c.mimeType.startsWith("image/")&&_?`<img class="lc-chip-thumb" src="${A(_)}" alt="">`:"",S=p?`${m}<span class="lc-chip-label lc-chip-uploading">Uploading…</span>`:`${m}<span class="lc-chip-label">${A(c.originalFilename)}</span><button data-i="${d}" aria-label="Remove">×</button>`;return`<span class="lc-chip${p?" lc-chip--busy":""}">${S}</span>`}).join(""),M.querySelectorAll("button[data-i]").forEach(c=>{c.addEventListener("click",()=>{const d=Number(c.dataset.i),p=I.splice(d,1)[0];p!=null&&p.localUrl&&URL.revokeObjectURL(p.localUrl),X()})})}let Fe=null,$t=!1;const ae=c=>{var d;$t!==c&&($t=c,(d=t.socket)==null||d.emit("livechat:typing",{on:c}))};y.addEventListener("input",()=>{y.style.height="auto",y.style.height=Math.min(120,y.scrollHeight)+"px",y.value.trim()?(ae(!0),Fe&&clearTimeout(Fe),Fe=setTimeout(()=>ae(!1),1500)):ae(!1)}),y.addEventListener("blur",()=>ae(!1)),y.addEventListener("keydown",c=>{c.key==="Enter"&&!c.shiftKey&&(c.preventDefault(),$.requestSubmit())}),y.addEventListener("paste",async c=>{var _;const d=(_=c.clipboardData)==null?void 0:_.items;if(!d)return;const p=[];for(const u of d)if(u.kind==="file"&&u.type.startsWith("image/")){const m=u.getAsFile();m&&p.push(m)}if(p.length){if(c.preventDefault(),!t.sessionId){j(r,"Send a message first, then paste images.");return}for(const u of p){if(u.size>10*1024*1024){j(r,`Pasted image too large: ${u.name||"image"} (max 10 MB)`);continue}if(I.length>=5)break;const m=u.name?u:new File([u],`pasted-${Date.now()}.png`,{type:u.type}),S=URL.createObjectURL(m),E={id:"pending-"+Math.random().toString(36).slice(2),mimeType:u.type,sizeBytes:u.size,originalFilename:m.name,url:"",localUrl:S};I.push(E),X();try{const K=await O(e,t.sessionId,m),C=I.indexOf(E);C>=0&&(I[C]=ne(Q({},K),{localUrl:S})),X()}catch(K){const C=I.indexOf(E);C>=0&&I.splice(C,1),URL.revokeObjectURL(S),j(r,`Upload failed: ${K.message}`),X()}}}}),$.addEventListener("submit",async c=>{var u;if(c.preventDefault(),z.value)return;if(t.sessionClosed){j(r,"This conversation has ended. Start a new chat below.");return}const d=y.value.trim(),p=I.some(m=>m.id.startsWith("pending-")),_=I.filter(m=>m.url&&!m.id.startsWith("pending-"));if(p&&!d){j(r,"Your file is still uploading — please wait or add a message.");return}if(!(!d&&!_.length)){if(!si()){j(r,"Slow down — too many messages in the last minute.");return}U.disabled=!0,y.value="",y.style.height="auto",ae(!1),ii(t,d,_),I.length=0,X(),Ct(),i(),yt(r);try{const m=await Kt(e,d,_.map(S=>S.id),{hp:z.value||void 0,elapsedMs:Date.now()-Mi,hadInteraction:_e});if(re(r),t.sessionId=m.sessionId,oi(m.sessionId),"content"in m.agent&&m.agent.content){const S=(u=m.agent.id)!=null?u:"";t.messages.some(E=>E.id===S&&S)||bt(t,m.agent.content,S)}t.socket||mt(e,t,i,s),ti(r,t,i)}catch(m){re(r),j(r,"Could not send — please try again.")}U.disabled=!1,i()}});const Nt=r.querySelector(".lc-messages");return Nt.addEventListener("click",async c=>{var u,m;const d=c.target,p=d.closest(".lc-inline-skip");if(p){const S=p.getAttribute("data-step");if(S==="name")try{localStorage.setItem(ge,"skipped")}catch(E){}else if(S==="email")try{localStorage.setItem(ze,"skipped")}catch(E){}t.messages=t.messages.filter(E=>E.id!==`identify-${S}`),i();return}const _=d.closest(".lc-inline-save");if(_){const S=_.getAttribute("data-step"),E=_.closest(".lc-inline-identify"),K=E==null?void 0:E.querySelector("input"),C=(m=(u=K==null?void 0:K.value)==null?void 0:u.trim())!=null?m:"";if(S==="name"){if(!C)return;try{await Ve(e,{name:C}),t.knownName=C;try{localStorage.setItem(ge,C)}catch(G){}const te=t.messages.findIndex(G=>G.id==="identify-name");te>=0&&(t.messages[te]={id:"identify-name-done",role:"system",content:`Nice to meet you, ${C}!`,createdAt:new Date().toISOString()}),i()}catch(te){}}else if(S==="email"){const te=G=>{var jt;K==null||K.classList.add("lc-inline-input--invalid");let V=E==null?void 0:E.querySelector(".lc-inline-error");!V&&E&&(V=document.createElement("div"),V.className="lc-inline-error",(jt=E.querySelector(".lc-inline-row"))==null||jt.after(V)),V&&(V.textContent=G)};if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(C)){te("That doesn't look right — double-check?");return}if(await Vn(C)){te("Please use a permanent email — we can’t follow up on temporary inboxes.");return}try{await Ve(e,{email:C});try{localStorage.setItem(ze,"saved")}catch(V){}try{localStorage.setItem(je,"saved")}catch(V){}const G=t.messages.findIndex(V=>V.id==="identify-email");G>=0&&(t.messages[G]={id:"identify-email-done",role:"system",content:`Great — we'll reach out at ${C} if we miss you here.`,createdAt:new Date().toISOString()}),i()}catch(G){}}}}),Nt.addEventListener("keydown",c=>{const d=c;if(d.key!=="Enter")return;const p=d.target;if(!p.matches(".lc-inline-identify input"))return;d.preventDefault();const _=p.closest(".lc-inline-identify"),u=_==null?void 0:_.querySelector(".lc-inline-save");u==null||u.click()}),Ct(),r}function mt(n,e,t,i){!e.sessionId||e.socket||(e.socket=jn(n,e.sessionId,s=>{var a,b,x,w,h,R,B,k,$,y,z,U;if(s.type==="typing"){const f=e.panel;if(!f)return;s.on?yt(f):re(f);return}if(s.type==="session_status"&&s.status==="closed"){(a=e.socket)==null||a.disconnect(),e.socket=null,e.sessionClosed=!0;const f=e.panel;if(f){const v=f.querySelector(".lc-session-end"),M=f.querySelector("textarea"),Y=f.querySelector('.lc-composer button[type="submit"]'),xe=f.querySelector(".lc-attach-btn");v&&(v.style.display="flex"),M&&(M.disabled=!0),Y&&(Y.disabled=!0),xe&&(xe.disabled=!0),e.feedbackAsked||(e.feedbackAsked=!0,e.messages.push({id:`feedback-${Date.now()}`,role:"system",content:"__feedback__",createdAt:new Date().toISOString()}))}t();return}if(s.type==="agent_stream_start"&&s.draftId){const f=e.panel;f&&re(f),e.messages.some(v=>v.id===s.draftId)||(e.messages.push({id:s.draftId,role:"agent",content:"",createdAt:(b=s.createdAt)!=null?b:new Date().toISOString()}),t());return}if(s.type==="agent_stream_delta"&&s.draftId&&s.delta){const f=e.messages.findIndex(v=>v.id===s.draftId);f>=0&&(e.messages[f]=ne(Q({},e.messages[f]),{content:e.messages[f].content+s.delta}),t());return}if(s.type==="agent_stream_end"&&s.draftId&&s.messageId){const f=e.messages.findIndex(v=>v.id===s.draftId);f>=0&&(e.messages[f]=ne(Q({},e.messages[f]),{id:s.messageId,content:(x=s.content)!=null?x:e.messages[f].content}),ee(e.messages),e.open||(e.unread=((w=e.unread)!=null?w:0)+1,xt()),t());return}if(s.type==="agent_suggestions"&&s.messageId&&((h=s.suggestions)!=null&&h.length)){const f=e.messages.findIndex(v=>v.id===s.messageId);f>=0&&(e.messages[f]=ne(Q({},e.messages[f]),{suggestions:s.suggestions.slice(0,3)}),t());return}if(s.type!=="message"||!s.messageId||s.role==="visitor"||e.messages.some(f=>f.id===s.messageId))return;const r=(R=s.operatorName)!=null?R:void 0,o=(y=s.operatorAvatarUrl)!=null?y:r&&($=(k=(B=i==null?void 0:i.operators)==null?void 0:B.find(f=>f.name===r))==null?void 0:k.avatarUrl)!=null?$:void 0;bt(e,(z=s.content)!=null?z:"",s.messageId,s.role==="operator",s.attachments,r,o);const l=e.panel;l&&re(l),e.open||(e.unread=((U=e.unread)!=null?U:0)+1,xt()),t()}))}function ei(n,e){const t=n.querySelector(".lc-messages");if(!t)return;if(e.messages.length===0){t.innerHTML='<div class="lc-empty">Send us a message — we will get right back to you.</div>';return}const i=(()=>{for(let s=e.messages.length-1;s>=0;s--){const r=e.messages[s];if(r.role==="agent"||r.role==="operator")return s;if(r.role==="visitor")return-1}return-1})();t.innerHTML=e.messages.map((s,r)=>{var R,B;if(s.content==="__identify_name__"||s.content==="__identify_email__"){const k=s.content==="__identify_name__",$=k?"name":"email",y=!k&&e.knownName?`<span class="lc-inline-greet">Thanks ${A(e.knownName)}! </span>`:"",z=k?"Mind if I get your name?":`${y}If we miss you here, what's the best email to follow up on?`,U=k?"Your name":"you@example.com",f=k?"text":"email",v=k?"given-name":"email";return`<div class="lc-msg-row lc-msg-row-agent">
          <div class="lc-msg-avatar lc-msg-avatar-ai">${kt()}</div>
          <div class="lc-msg-body">
            <div class="lc-msg lc-msg-agent lc-inline-identify" data-step="${$}">
              <div class="lc-inline-prompt">${z}</div>
              <div class="lc-inline-row">
                <input type="${f}" class="lc-inline-input" placeholder="${U}" autocomplete="${v}" />
                <button type="button" class="lc-inline-save" data-step="${$}" aria-label="Save">${_t()}</button>
              </div>
              <button type="button" class="lc-inline-skip" data-step="${$}">${k?"Skip":"Maybe later"}</button>
            </div>
          </div>
        </div>`}const o=s.content?s.role==="visitor"?di(s.content):hi(s.content):"",l=((R=s.attachments)!=null?R:[]).map(li).join(""),a=l?`<div class="lc-attachments">${l}</div>`:"",b=ui(s.createdAt),x=b?`<div class="lc-msg-time">${b}</div>`:"",w=r===i&&s.suggestions&&s.suggestions.length?`<div class="lc-chips">${s.suggestions.map(k=>`<button class="lc-chip" data-chip="${q(k)}">${A(k)}</button>`).join("")}</div>`:"";if(s.role==="system")return s.content==="__feedback__"?`<div class="lc-msg lc-msg-system lc-feedback" data-feedback-id="${q(s.id)}">
            <span>How was this chat?</span>
            <button class="lc-fb-btn" data-rating="up" aria-label="Good">👍</button>
            <button class="lc-fb-btn" data-rating="down" aria-label="Bad">👎</button>
          </div>`:`<div class="lc-msg lc-msg-system">${o}</div>`;if(s.role==="visitor")return`<div class="lc-msg-row lc-msg-row-visitor">
          <div class="lc-msg-body">
            <div class="lc-msg lc-msg-visitor">${o}${a}</div>
            ${x}
          </div>
        </div>`;const h=s.id&&s.id!=="welcome"?`<div class="lc-msg-rating" data-msg-id="${q(s.id)}">
            <button class="lc-rate-btn" data-rating="up" aria-label="Helpful">&#128077;</button>
            <button class="lc-rate-btn" data-rating="down" aria-label="Not helpful">&#128078;</button>
           </div>`:"";if(s.role==="operator"){const k=(B=s.operatorName)!=null?B:"Operator";return`<div class="lc-msg-row lc-msg-row-agent">
          ${s.operatorAvatarUrl?`<img class="lc-msg-avatar lc-msg-avatar-img" src="${q(s.operatorAvatarUrl)}" alt="${A(k)}">`:`<div class="lc-msg-avatar lc-msg-avatar-op" title="${A(k)}">${A(Ue(k))}</div>`}
          <div class="lc-msg-body">
            <div class="lc-msg-sender">${A(k)}</div>
            <div class="lc-msg lc-msg-agent">${o}${a}</div>
            ${x}
            ${w}
            ${h}
          </div>
        </div>`}return`<div class="lc-msg-row lc-msg-row-agent">
        <div class="lc-msg-avatar lc-msg-avatar-ai">${kt()}</div>
        <div class="lc-msg-body">
          <div class="lc-msg lc-msg-agent">${o}${a}</div>
          ${x}
          ${w}
          ${h}
        </div>
      </div>`}).join(""),t.querySelectorAll(".lc-msg-rating").forEach(s=>{s.querySelectorAll(".lc-rate-btn").forEach(r=>{r.addEventListener("click",async()=>{var x,w,h;const o=r.getAttribute("data-rating"),l=(x=s.getAttribute("data-msg-id"))!=null?x:"",a=(h=(w=n._state)==null?void 0:w.sessionId)!=null?h:"",b=n._cfg;if(!(!l||!a||!b)){s.querySelectorAll(".lc-rate-btn").forEach(R=>R.disabled=!0),r.classList.add("lc-rate-btn--active");try{await fetch(`${b.apiBase}/livechat/session/${encodeURIComponent(a)}/message/${encodeURIComponent(l)}/rating`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({siteKey:b.siteKey,visitorId:b.visitorId,rating:o}),credentials:"omit"})}catch(R){}}})})}),t.querySelectorAll(".lc-chip").forEach(s=>{s.addEventListener("click",()=>{var l;const r=(l=s.getAttribute("data-chip"))!=null?l:"";if(!r)return;const o=n._submitFromChip;if(o)o(r);else{const a=n.querySelector("textarea"),b=n.querySelector(".lc-composer");if(!a||!b)return;a.value=r,a.dispatchEvent(new Event("input",{bubbles:!0})),b.requestSubmit()}})}),t.querySelectorAll(".lc-fb-btn").forEach(s=>{s.addEventListener("click",async()=>{const r=s.closest(".lc-feedback"),o=s.getAttribute("data-rating");if(!r||!o)return;const l=e.sessionId,a=e.cfg;if(l&&a)try{await fetch(`${a.apiBase}/livechat/session/${encodeURIComponent(l)}/feedback`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({siteKey:a.siteKey,visitorId:a.visitorId,rating:o}),credentials:"omit"})}catch(b){}r.innerHTML="<span>Thanks for the feedback!</span>"})}),gt(n)}function gt(n){const e=n.querySelector(".lc-messages");e&&(e.scrollTop=e.scrollHeight)}function yt(n){const e=n.querySelector(".lc-messages");if(!e||e.querySelector(".lc-typing"))return;const t=document.createElement("div");t.className="lc-typing",t.innerHTML="<span></span><span></span><span></span>",e.appendChild(t),e.scrollTop=e.scrollHeight}function re(n){n.querySelectorAll(".lc-typing").forEach(e=>e.remove())}function ti(n,e,t){let i=!1;try{i=!!localStorage.getItem(je)}catch(h){}const s=e.messages,r=s.filter(h=>h.role==="visitor").length,o=s.filter(h=>h.role==="agent").length;let l=null;try{l=localStorage.getItem(ge)}catch(h){}const a=!!l||!!e.knownName||i,b=s.some(h=>h.id==="identify-name"||h.id==="identify-name-done");!a&&!b&&o>=1&&(e.askedForName=!0,e.messages.push({id:"identify-name",role:"agent",content:"__identify_name__",createdAt:new Date().toISOString()}),t());let x=!1;try{x=!!localStorage.getItem(ze)}catch(h){}const w=s.some(h=>h.id==="identify-email"||h.id==="identify-email-done");!x&&!i&&!w&&r>=Gn&&(e.askedForEmail=!0,e.messages.push({id:"identify-email",role:"agent",content:"__identify_email__",createdAt:new Date().toISOString()}),t())}function ni(){try{const n=localStorage.getItem(ge);return!n||n==="saved"||n==="skipped"?null:n}catch(n){return null}}function ii(n,e,t){n.messages.push({id:"local-"+Date.now(),role:"visitor",content:e,createdAt:new Date().toISOString(),attachments:t}),ee(n.messages)}function bt(n,e,t,i=!1,s,r,o){n.messages.push({id:t||"srv-"+Date.now(),role:i?"operator":"agent",content:e,createdAt:new Date().toISOString(),attachments:s,operatorName:r,operatorAvatarUrl:o}),ee(n.messages)}function si(){var n;try{const e=Date.now(),t=JSON.parse((n=localStorage.getItem(ft))!=null?n:"[]").filter(i=>e-i<Xn);return t.length>=Jn?!1:(t.push(e),localStorage.setItem(ft,JSON.stringify(t)),!0)}catch(e){return!0}}function ri(){try{return localStorage.getItem(Pe)}catch(n){return null}}function oi(n){try{localStorage.setItem(Pe,n)}catch(e){}}function ai(){try{const n=localStorage.getItem(De);return n?JSON.parse(n):[]}catch(n){return[]}}function ee(n){try{localStorage.setItem(De,JSON.stringify(n.slice(-50)))}catch(e){}}function xt(){try{const n=new(window.AudioContext||window.webkitAudioContext),e=n.createOscillator(),t=n.createGain();e.connect(t),t.connect(n.destination),e.type="sine",e.frequency.setValueAtTime(880,n.currentTime),e.frequency.setValueAtTime(1100,n.currentTime+.08),t.gain.setValueAtTime(.12,n.currentTime),t.gain.exponentialRampToValueAtTime(.001,n.currentTime+.35),e.start(n.currentTime),e.stop(n.currentTime+.35)}catch(n){}}function A(n){return n.replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}function ci(n){if(!n)return null;const e=n.trim();return/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(e)?e:null}function vt(n,e){let t=n.replace("#","");t.length===3&&(t=t.split("").map(o=>o+o).join(""));const i=parseInt(t.slice(0,2),16),s=parseInt(t.slice(2,4),16),r=parseInt(t.slice(4,6),16);return`rgba(${i}, ${s}, ${r}, ${e})`}function li(n){if(n.mimeType.startsWith("image/")&&n.url)return`<a href="${q(n.url)}" target="_blank" rel="noopener noreferrer"><img class="lc-attach-img" src="${q(n.url)}" alt="${q(n.originalFilename)}" /></a>`;const t=pi(n.sizeBytes);return`<a class="lc-attach-file" href="${n.url?q(n.url):"#"}" target="_blank" rel="noopener noreferrer">${mi()}<span>${A(n.originalFilename)}</span><span class="lc-attach-size">${t}</span></a>`}function di(n){return A(n).replace(/(https?:\/\/[^\s<]+)/g,t=>{const i=t.match(/[.,;:!?)]+$/),s=i?i[0]:"",r=s?t.slice(0,-s.length):t;return`<a href="${q(r)}" target="_blank" rel="noopener noreferrer nofollow">${r}</a>${s}`})}function hi(n){let e=A(n);const t=[];return e=e.replace(/`([^`\n]+)`/g,(i,s)=>(t.push(`<code class="lc-md-code">${s}</code>`),`\0C${t.length-1}\0`)),e=e.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,(i,s,r)=>`<a href="${q(r)}" target="_blank" rel="noopener noreferrer nofollow">${s}</a>`),e=e.replace(/\*\*([^*\n]+?)\*\*/g,"<strong>$1</strong>"),e=e.replace(/(^|[\s(])\*([^*\n]+?)\*(?=[\s.,;:!?)]|$)/g,"$1<em>$2</em>"),e=e.replace(/(^|[\s>])(https?:\/\/[^\s<]+)/g,(i,s,r)=>{const o=r.match(/[.,;:!?)]+$/),l=o?o[0]:"",a=l?r.slice(0,-l.length):r;return`${s}<a href="${q(a)}" target="_blank" rel="noopener noreferrer nofollow">${a}</a>${l}`}),e=e.replace(/ C(\d+) /g,(i,s)=>{var r;return(r=t[Number(s)])!=null?r:""}),e=e.replace(/\n/g,"<br>"),e}function q(n){return n.replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}function pi(n){return n<1024?`${n} B`:n<1024*1024?`${(n/1024).toFixed(0)} KB`:`${(n/1024/1024).toFixed(1)} MB`}function j(n,e,t=3500){const i=n.querySelector(".lc-toast");i&&(i.textContent=e,i.style.display="block",clearTimeout(i._timer),i._timer=setTimeout(()=>{i.style.display="none"},t))}function Ue(n){return n.trim().split(/\s+/).map(e=>{var t;return(t=e[0])!=null?t:""}).join("").slice(0,2).toUpperCase()}function ui(n){try{const e=new Date(n);return isNaN(e.getTime())?"":e.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}catch(e){return""}}function fi(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 17.93 8.83l-8.58 8.57a2 2 0 1 1-2.83-2.83l8.49-8.48"/></svg>'}function mi(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>'}function gi(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'}function yi(){return'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>'}function wt(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>'}function _t(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>'}function bi(){return'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="6" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="18" r="1.5"/></svg>'}function xi(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15.5-6.36L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.36L3 16"/><path d="M3 21v-5h5"/></svg>'}function vi(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'}function wi(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>'}function kt(){return'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4M22 5h-4M4 17v2M5 18H3"/></svg>'}function _i(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>'}function ki(n,e){return!n.length&&(e!=null&&e.trim())?`<div class="lc-header-avatars"><div class="lc-op-avatar lc-op-initials" style="z-index:3">${A(Ue(e.trim()))}</div></div>`:n.length?`<div class="lc-header-avatars">${n.slice(0,3).map((s,r)=>{const o=r===0?"":"margin-left:-10px;",l=`z-index:${3-r};`;return s.avatarUrl?`<img class="lc-op-avatar" src="${q(s.avatarUrl)}" alt="${A(s.name)}" style="${l}${o}">`:`<div class="lc-op-avatar lc-op-initials" style="${l}${o}">${A(Ue(s.name))}</div>`}).join("")}</div>`:`<div class="lc-header-avatar">${yi()}</div>`}let St="",oe=null,be=null;const Si=3e4;function Ei(n){Et(n),Ai(n),window.addEventListener("popstate",()=>He(n)),window.addEventListener("pagehide",()=>{oe&&Ke(n,oe)}),Ti(n)}function Ti(n){const e=()=>{document.visibilityState==="visible"&&Ft(n,{url:location.href,title:document.title})};setInterval(e,Si),document.addEventListener("visibilitychange",()=>{document.visibilityState==="visible"&&e()})}function Ai(n){const e={pushState:history.pushState,replaceState:history.replaceState};history.pushState=function(...t){const i=e.pushState.apply(this,t);return He(n),i},history.replaceState=function(...t){const i=e.replaceState.apply(this,t);return He(n),i}}function He(n){be&&clearTimeout(be),be=setTimeout(()=>Et(n),300)}async function Et(n){var t;be=null;const e=location.pathname+location.search;if(e!==St){St=e,oe&&Ke(n,oe);try{oe=(t=(await Ht(n,{url:location.href,path:location.pathname,title:document.title,referrer:document.referrer,language:navigator.language})).pageviewId)!=null?t:null}catch(i){}}}const Tt="livechat_visitor_id";function Ii(){const n=Oi();if(!n)return null;const e=n.getAttribute("data-site");if(!e)return null;const t=n.getAttribute("data-api")||Li(n)||"",i=Ri();return{siteKey:e,visitorId:i,apiBase:t}}function Oi(){const n=document.querySelectorAll("script[data-site]");return n.length?n[n.length-1]:null}function Li(n){if(!n.src)return null;try{const e=new URL(n.src);return`${e.protocol}//${e.host}`}catch(e){return null}}function Ri(){try{const n=localStorage.getItem(Tt);if(n)return n;const e=At();return localStorage.setItem(Tt,e),e}catch(n){return At()}}function At(){if(typeof crypto!="undefined"&&crypto.randomUUID)return crypto.randomUUID();let n=Date.now();return"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,e=>{const t=(n+Math.random()*16)%16|0;return n=Math.floor(n/16),(e==="x"?t:t&3|8).toString(16)})}const It="livechat_build",Bi=["livechat_messages_cache","livechat_session_id","livechat_identify_dismissed","livechat_send_log","livechat_proactive_seen"];function Ci(){try{localStorage.getItem(It)!=="mon9www0"&&(Bi.forEach(n=>localStorage.removeItem(n)),localStorage.setItem(It,"mon9www0"))}catch(n){}}(function(){var i;if(typeof window=="undefined"||(i=window.__livechat__)!=null&&i.mounted)return;Ci();const e=Ii();if(!e)return;window.__livechat__={mounted:!0,siteKey:e.siteKey,visitorId:e.visitorId},Ei(e);const t=async()=>{const s=await D(e);Qn(e,s!=null?s:void 0)};document.readyState==="loading"?document.addEventListener("DOMContentLoaded",t):t()})()})();
