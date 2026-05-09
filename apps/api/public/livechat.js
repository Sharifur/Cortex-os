var Ui=Object.defineProperty,Hi=Object.defineProperties;var Fi=Object.getOwnPropertyDescriptors;var Wt=Object.getOwnPropertySymbols;var Vi=Object.prototype.hasOwnProperty,Ki=Object.prototype.propertyIsEnumerable;var Jt=(Y,j,z)=>j in Y?Ui(Y,j,{enumerable:!0,configurable:!0,writable:!0,value:z}):Y[j]=z,oe=(Y,j)=>{for(var z in j||(j={}))Vi.call(j,z)&&Jt(Y,z,j[z]);if(Wt)for(var z of Wt(j))Ki.call(j,z)&&Jt(Y,z,j[z]);return Y},me=(Y,j)=>Hi(Y,Fi(j));(function(){"use strict";async function Y(n){try{const e=await fetch(`${n.apiBase}/livechat/config?siteKey=${encodeURIComponent(n.siteKey)}`,{method:"GET",credentials:"omit"});return e.ok?await e.json():null}catch(e){return null}}async function j(n,e,t){const i=new FormData;i.append("siteKey",n.siteKey),i.append("visitorId",n.visitorId),i.append("sessionId",e),i.append("file",t,t.name);const s=await fetch(`${n.apiBase}/livechat/upload`,{method:"POST",body:i,credentials:"omit"});if(!s.ok){const r=await s.text().catch(()=>"");throw new Error(`${s.status} ${s.statusText}${r?` — ${r}`:""}`)}return s.json()}async function z(n,e){const t=await fetch(n,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(e),credentials:"omit"});if(!t.ok){const i=await t.text().catch(()=>"");throw new Error(`${t.status} ${t.statusText}${i?` — ${i}`:""}`)}return t.json()}function Xt(n,e){return z(`${n.apiBase}/livechat/track/pageview`,oe({siteKey:n.siteKey,visitorId:n.visitorId},e))}function Gt(n,e){return z(`${n.apiBase}/livechat/track/heartbeat`,{siteKey:n.siteKey,visitorId:n.visitorId,url:e.url,title:e.title}).catch(()=>{})}function it(n,e){const t=`${n.apiBase}/livechat/track/leave`,i=JSON.stringify({siteKey:n.siteKey,visitorId:n.visitorId,pageviewId:e});if(navigator.sendBeacon){const s=new Blob([i],{type:"application/json"});navigator.sendBeacon(t,s);return}fetch(t,{method:"POST",headers:{"Content-Type":"application/json"},body:i,keepalive:!0}).catch(()=>{})}function Qt(n,e,t,i,s,r,o){return z(`${n.apiBase}/livechat/message`,{siteKey:n.siteKey,visitorId:n.visitorId,content:e,attachmentIds:t&&t.length?t:void 0,meta:i,pageContext:s,replyToId:void 0,replyToContent:void 0})}function st(n,e){return z(`${n.apiBase}/livechat/identify`,{siteKey:n.siteKey,visitorId:n.visitorId,email:e.email,name:e.name})}const Q=Object.create(null);Q.open="0",Q.close="1",Q.ping="2",Q.pong="3",Q.message="4",Q.upgrade="5",Q.noop="6";const ke=Object.create(null);Object.keys(Q).forEach(n=>{ke[Q[n]]=n});const qe={type:"error",data:"parser error"},rt=typeof Blob=="function"||typeof Blob!="undefined"&&Object.prototype.toString.call(Blob)==="[object BlobConstructor]",ot=typeof ArrayBuffer=="function",at=n=>typeof ArrayBuffer.isView=="function"?ArrayBuffer.isView(n):n&&n.buffer instanceof ArrayBuffer,Pe=({type:n,data:e},t,i)=>rt&&e instanceof Blob?t?i(e):ct(e,i):ot&&(e instanceof ArrayBuffer||at(e))?t?i(e):ct(new Blob([e]),i):i(Q[n]+(e||"")),ct=(n,e)=>{const t=new FileReader;return t.onload=function(){const i=t.result.split(",")[1];e("b"+(i||""))},t.readAsDataURL(n)};function lt(n){return n instanceof Uint8Array?n:n instanceof ArrayBuffer?new Uint8Array(n):new Uint8Array(n.buffer,n.byteOffset,n.byteLength)}let Me;function Zt(n,e){if(rt&&n.data instanceof Blob)return n.data.arrayBuffer().then(lt).then(e);if(ot&&(n.data instanceof ArrayBuffer||at(n.data)))return e(lt(n.data));Pe(n,!1,t=>{Me||(Me=new TextEncoder),e(Me.encode(t))})}const dt="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",ge=typeof Uint8Array=="undefined"?[]:new Uint8Array(256);for(let n=0;n<dt.length;n++)ge[dt.charCodeAt(n)]=n;const en=n=>{let e=n.length*.75,t=n.length,i,s=0,r,o,c,l;n[n.length-1]==="="&&(e--,n[n.length-2]==="="&&e--);const x=new ArrayBuffer(e),k=new Uint8Array(x);for(i=0;i<t;i+=4)r=ge[n.charCodeAt(i)],o=ge[n.charCodeAt(i+1)],c=ge[n.charCodeAt(i+2)],l=ge[n.charCodeAt(i+3)],k[s++]=r<<2|o>>4,k[s++]=(o&15)<<4|c>>2,k[s++]=(c&3)<<6|l&63;return x},tn=typeof ArrayBuffer=="function",De=(n,e)=>{if(typeof n!="string")return{type:"message",data:pt(n,e)};const t=n.charAt(0);return t==="b"?{type:"message",data:nn(n.substring(1),e)}:ke[t]?n.length>1?{type:ke[t],data:n.substring(1)}:{type:ke[t]}:qe},nn=(n,e)=>{if(tn){const t=en(n);return pt(t,e)}else return{base64:!0,data:n}},pt=(n,e)=>{switch(e){case"blob":return n instanceof Blob?n:new Blob([n]);case"arraybuffer":default:return n instanceof ArrayBuffer?n:n.buffer}},ht="",sn=(n,e)=>{const t=n.length,i=new Array(t);let s=0;n.forEach((r,o)=>{Pe(r,!1,c=>{i[o]=c,++s===t&&e(i.join(ht))})})},rn=(n,e)=>{const t=n.split(ht),i=[];for(let s=0;s<t.length;s++){const r=De(t[s],e);if(i.push(r),r.type==="error")break}return i};function on(){return new TransformStream({transform(n,e){Zt(n,t=>{const i=t.length;let s;if(i<126)s=new Uint8Array(1),new DataView(s.buffer).setUint8(0,i);else if(i<65536){s=new Uint8Array(3);const r=new DataView(s.buffer);r.setUint8(0,126),r.setUint16(1,i)}else{s=new Uint8Array(9);const r=new DataView(s.buffer);r.setUint8(0,127),r.setBigUint64(1,BigInt(i))}n.data&&typeof n.data!="string"&&(s[0]|=128),e.enqueue(s),e.enqueue(t)})}})}let je;function Se(n){return n.reduce((e,t)=>e+t.length,0)}function Ee(n,e){if(n[0].length===e)return n.shift();const t=new Uint8Array(e);let i=0;for(let s=0;s<e;s++)t[s]=n[0][i++],i===n[0].length&&(n.shift(),i=0);return n.length&&i<n[0].length&&(n[0]=n[0].slice(i)),t}function an(n,e){je||(je=new TextDecoder);const t=[];let i=0,s=-1,r=!1;return new TransformStream({transform(o,c){for(t.push(o);;){if(i===0){if(Se(t)<1)break;const l=Ee(t,1);r=(l[0]&128)===128,s=l[0]&127,s<126?i=3:s===126?i=1:i=2}else if(i===1){if(Se(t)<2)break;const l=Ee(t,2);s=new DataView(l.buffer,l.byteOffset,l.length).getUint16(0),i=3}else if(i===2){if(Se(t)<8)break;const l=Ee(t,8),x=new DataView(l.buffer,l.byteOffset,l.length),k=x.getUint32(0);if(k>Math.pow(2,21)-1){c.enqueue(qe);break}s=k*Math.pow(2,32)+x.getUint32(4),i=3}else{if(Se(t)<s)break;const l=Ee(t,s);c.enqueue(De(r?l:je.decode(l),e)),i=0}if(s===0||s>n){c.enqueue(qe);break}}}})}const ut=4;function R(n){if(n)return cn(n)}function cn(n){for(var e in R.prototype)n[e]=R.prototype[e];return n}R.prototype.on=R.prototype.addEventListener=function(n,e){return this._callbacks=this._callbacks||{},(this._callbacks["$"+n]=this._callbacks["$"+n]||[]).push(e),this},R.prototype.once=function(n,e){function t(){this.off(n,t),e.apply(this,arguments)}return t.fn=e,this.on(n,t),this},R.prototype.off=R.prototype.removeListener=R.prototype.removeAllListeners=R.prototype.removeEventListener=function(n,e){if(this._callbacks=this._callbacks||{},arguments.length==0)return this._callbacks={},this;var t=this._callbacks["$"+n];if(!t)return this;if(arguments.length==1)return delete this._callbacks["$"+n],this;for(var i,s=0;s<t.length;s++)if(i=t[s],i===e||i.fn===e){t.splice(s,1);break}return t.length===0&&delete this._callbacks["$"+n],this},R.prototype.emit=function(n){this._callbacks=this._callbacks||{};for(var e=new Array(arguments.length-1),t=this._callbacks["$"+n],i=1;i<arguments.length;i++)e[i-1]=arguments[i];if(t){t=t.slice(0);for(var i=0,s=t.length;i<s;++i)t[i].apply(this,e)}return this},R.prototype.emitReserved=R.prototype.emit,R.prototype.listeners=function(n){return this._callbacks=this._callbacks||{},this._callbacks["$"+n]||[]},R.prototype.hasListeners=function(n){return!!this.listeners(n).length};const Te=typeof Promise=="function"&&typeof Promise.resolve=="function"?e=>Promise.resolve().then(e):(e,t)=>t(e,0),H=typeof self!="undefined"?self:typeof window!="undefined"?window:Function("return this")(),ln="arraybuffer";function Yi(){}function ft(n,...e){return e.reduce((t,i)=>(n.hasOwnProperty(i)&&(t[i]=n[i]),t),{})}const dn=H.setTimeout,pn=H.clearTimeout;function Ie(n,e){e.useNativeTimers?(n.setTimeoutFn=dn.bind(H),n.clearTimeoutFn=pn.bind(H)):(n.setTimeoutFn=H.setTimeout.bind(H),n.clearTimeoutFn=H.clearTimeout.bind(H))}const hn=1.33;function un(n){return typeof n=="string"?fn(n):Math.ceil((n.byteLength||n.size)*hn)}function fn(n){let e=0,t=0;for(let i=0,s=n.length;i<s;i++)e=n.charCodeAt(i),e<128?t+=1:e<2048?t+=2:e<55296||e>=57344?t+=3:(i++,t+=4);return t}function mt(){return Date.now().toString(36).substring(3)+Math.random().toString(36).substring(2,5)}function mn(n){let e="";for(let t in n)n.hasOwnProperty(t)&&(e.length&&(e+="&"),e+=encodeURIComponent(t)+"="+encodeURIComponent(n[t]));return e}function gn(n){let e={},t=n.split("&");for(let i=0,s=t.length;i<s;i++){let r=t[i].split("=");e[decodeURIComponent(r[0])]=decodeURIComponent(r[1])}return e}class yn extends Error{constructor(e,t,i){super(e),this.description=t,this.context=i,this.type="TransportError"}}class ze extends R{constructor(e){super(),this.writable=!1,Ie(this,e),this.opts=e,this.query=e.query,this.socket=e.socket,this.supportsBinary=!e.forceBase64}onError(e,t,i){return super.emitReserved("error",new yn(e,t,i)),this}open(){return this.readyState="opening",this.doOpen(),this}close(){return(this.readyState==="opening"||this.readyState==="open")&&(this.doClose(),this.onClose()),this}send(e){this.readyState==="open"&&this.write(e)}onOpen(){this.readyState="open",this.writable=!0,super.emitReserved("open")}onData(e){const t=De(e,this.socket.binaryType);this.onPacket(t)}onPacket(e){super.emitReserved("packet",e)}onClose(e){this.readyState="closed",super.emitReserved("close",e)}pause(e){}createUri(e,t={}){return e+"://"+this._hostname()+this._port()+this.opts.path+this._query(t)}_hostname(){const e=this.opts.hostname;return e.indexOf(":")===-1?e:"["+e+"]"}_port(){return this.opts.port&&(this.opts.secure&&Number(this.opts.port)!==443||!this.opts.secure&&Number(this.opts.port)!==80)?":"+this.opts.port:""}_query(e){const t=mn(e);return t.length?"?"+t:""}}class bn extends ze{constructor(){super(...arguments),this._polling=!1}get name(){return"polling"}doOpen(){this._poll()}pause(e){this.readyState="pausing";const t=()=>{this.readyState="paused",e()};if(this._polling||!this.writable){let i=0;this._polling&&(i++,this.once("pollComplete",function(){--i||t()})),this.writable||(i++,this.once("drain",function(){--i||t()}))}else t()}_poll(){this._polling=!0,this.doPoll(),this.emitReserved("poll")}onData(e){const t=i=>{if(this.readyState==="opening"&&i.type==="open"&&this.onOpen(),i.type==="close")return this.onClose({description:"transport closed by the server"}),!1;this.onPacket(i)};rn(e,this.socket.binaryType).forEach(t),this.readyState!=="closed"&&(this._polling=!1,this.emitReserved("pollComplete"),this.readyState==="open"&&this._poll())}doClose(){const e=()=>{this.write([{type:"close"}])};this.readyState==="open"?e():this.once("open",e)}write(e){this.writable=!1,sn(e,t=>{this.doWrite(t,()=>{this.writable=!0,this.emitReserved("drain")})})}uri(){const e=this.opts.secure?"https":"http",t=this.query||{};return this.opts.timestampRequests!==!1&&(t[this.opts.timestampParam]=mt()),!this.supportsBinary&&!t.sid&&(t.b64=1),this.createUri(e,t)}}let gt=!1;try{gt=typeof XMLHttpRequest!="undefined"&&"withCredentials"in new XMLHttpRequest}catch(n){}const xn=gt;function vn(){}class wn extends bn{constructor(e){if(super(e),typeof location!="undefined"){const t=location.protocol==="https:";let i=location.port;i||(i=t?"443":"80"),this.xd=typeof location!="undefined"&&e.hostname!==location.hostname||i!==e.port}}doWrite(e,t){const i=this.request({method:"POST",data:e});i.on("success",t),i.on("error",(s,r)=>{this.onError("xhr post error",s,r)})}doPoll(){const e=this.request();e.on("data",this.onData.bind(this)),e.on("error",(t,i)=>{this.onError("xhr poll error",t,i)}),this.pollXhr=e}}class Z extends R{constructor(e,t,i){super(),this.createRequest=e,Ie(this,i),this._opts=i,this._method=i.method||"GET",this._uri=t,this._data=i.data!==void 0?i.data:null,this._create()}_create(){var e;const t=ft(this._opts,"agent","pfx","key","passphrase","cert","ca","ciphers","rejectUnauthorized","autoUnref");t.xdomain=!!this._opts.xd;const i=this._xhr=this.createRequest(t);try{i.open(this._method,this._uri,!0);try{if(this._opts.extraHeaders){i.setDisableHeaderCheck&&i.setDisableHeaderCheck(!0);for(let s in this._opts.extraHeaders)this._opts.extraHeaders.hasOwnProperty(s)&&i.setRequestHeader(s,this._opts.extraHeaders[s])}}catch(s){}if(this._method==="POST")try{i.setRequestHeader("Content-type","text/plain;charset=UTF-8")}catch(s){}try{i.setRequestHeader("Accept","*/*")}catch(s){}(e=this._opts.cookieJar)===null||e===void 0||e.addCookies(i),"withCredentials"in i&&(i.withCredentials=this._opts.withCredentials),this._opts.requestTimeout&&(i.timeout=this._opts.requestTimeout),i.onreadystatechange=()=>{var s;i.readyState===3&&((s=this._opts.cookieJar)===null||s===void 0||s.parseCookies(i.getResponseHeader("set-cookie"))),i.readyState===4&&(i.status===200||i.status===1223?this._onLoad():this.setTimeoutFn(()=>{this._onError(typeof i.status=="number"?i.status:0)},0))},i.send(this._data)}catch(s){this.setTimeoutFn(()=>{this._onError(s)},0);return}typeof document!="undefined"&&(this._index=Z.requestsCount++,Z.requests[this._index]=this)}_onError(e){this.emitReserved("error",e,this._xhr),this._cleanup(!0)}_cleanup(e){if(!(typeof this._xhr=="undefined"||this._xhr===null)){if(this._xhr.onreadystatechange=vn,e)try{this._xhr.abort()}catch(t){}typeof document!="undefined"&&delete Z.requests[this._index],this._xhr=null}}_onLoad(){const e=this._xhr.responseText;e!==null&&(this.emitReserved("data",e),this.emitReserved("success"),this._cleanup())}abort(){this._cleanup()}}if(Z.requestsCount=0,Z.requests={},typeof document!="undefined"){if(typeof attachEvent=="function")attachEvent("onunload",yt);else if(typeof addEventListener=="function"){const n="onpagehide"in H?"pagehide":"unload";addEventListener(n,yt,!1)}}function yt(){for(let n in Z.requests)Z.requests.hasOwnProperty(n)&&Z.requests[n].abort()}const _n=(function(){const n=bt({xdomain:!1});return n&&n.responseType!==null})();class kn extends wn{constructor(e){super(e);const t=e&&e.forceBase64;this.supportsBinary=_n&&!t}request(e={}){return Object.assign(e,{xd:this.xd},this.opts),new Z(bt,this.uri(),e)}}function bt(n){const e=n.xdomain;try{if(typeof XMLHttpRequest!="undefined"&&(!e||xn))return new XMLHttpRequest}catch(t){}if(!e)try{return new H[["Active"].concat("Object").join("X")]("Microsoft.XMLHTTP")}catch(t){}}const xt=typeof navigator!="undefined"&&typeof navigator.product=="string"&&navigator.product.toLowerCase()==="reactnative";class Sn extends ze{get name(){return"websocket"}doOpen(){const e=this.uri(),t=this.opts.protocols,i=xt?{}:ft(this.opts,"agent","perMessageDeflate","pfx","key","passphrase","cert","ca","ciphers","rejectUnauthorized","localAddress","protocolVersion","origin","maxPayload","family","checkServerIdentity");this.opts.extraHeaders&&(i.headers=this.opts.extraHeaders);try{this.ws=this.createSocket(e,t,i)}catch(s){return this.emitReserved("error",s)}this.ws.binaryType=this.socket.binaryType,this.addEventListeners()}addEventListeners(){this.ws.onopen=()=>{this.opts.autoUnref&&this.ws._socket.unref(),this.onOpen()},this.ws.onclose=e=>this.onClose({description:"websocket connection closed",context:e}),this.ws.onmessage=e=>this.onData(e.data),this.ws.onerror=e=>this.onError("websocket error",e)}write(e){this.writable=!1;for(let t=0;t<e.length;t++){const i=e[t],s=t===e.length-1;Pe(i,this.supportsBinary,r=>{try{this.doWrite(i,r)}catch(o){}s&&Te(()=>{this.writable=!0,this.emitReserved("drain")},this.setTimeoutFn)})}}doClose(){typeof this.ws!="undefined"&&(this.ws.onerror=()=>{},this.ws.close(),this.ws=null)}uri(){const e=this.opts.secure?"wss":"ws",t=this.query||{};return this.opts.timestampRequests&&(t[this.opts.timestampParam]=mt()),this.supportsBinary||(t.b64=1),this.createUri(e,t)}}const Ue=H.WebSocket||H.MozWebSocket;class En extends Sn{createSocket(e,t,i){return xt?new Ue(e,t,i):t?new Ue(e,t):new Ue(e)}doWrite(e,t){this.ws.send(t)}}class Tn extends ze{get name(){return"webtransport"}doOpen(){try{this._transport=new WebTransport(this.createUri("https"),this.opts.transportOptions[this.name])}catch(e){return this.emitReserved("error",e)}this._transport.closed.then(()=>{this.onClose()}).catch(e=>{this.onError("webtransport error",e)}),this._transport.ready.then(()=>{this._transport.createBidirectionalStream().then(e=>{const t=an(Number.MAX_SAFE_INTEGER,this.socket.binaryType),i=e.readable.pipeThrough(t).getReader(),s=on();s.readable.pipeTo(e.writable),this._writer=s.writable.getWriter();const r=()=>{i.read().then(({done:c,value:l})=>{c||(this.onPacket(l),r())}).catch(c=>{})};r();const o={type:"open"};this.query.sid&&(o.data=`{"sid":"${this.query.sid}"}`),this._writer.write(o).then(()=>this.onOpen())})})}write(e){this.writable=!1;for(let t=0;t<e.length;t++){const i=e[t],s=t===e.length-1;this._writer.write(i).then(()=>{s&&Te(()=>{this.writable=!0,this.emitReserved("drain")},this.setTimeoutFn)})}}doClose(){var e;(e=this._transport)===null||e===void 0||e.close()}}const In={websocket:En,webtransport:Tn,polling:kn},An=/^(?:(?![^:@\/?#]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@\/?#]*)(?::([^:@\/?#]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/,Ln=["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"];function He(n){if(n.length>8e3)throw"URI too long";const e=n,t=n.indexOf("["),i=n.indexOf("]");t!=-1&&i!=-1&&(n=n.substring(0,t)+n.substring(t,i).replace(/:/g,";")+n.substring(i,n.length));let s=An.exec(n||""),r={},o=14;for(;o--;)r[Ln[o]]=s[o]||"";return t!=-1&&i!=-1&&(r.source=e,r.host=r.host.substring(1,r.host.length-1).replace(/;/g,":"),r.authority=r.authority.replace("[","").replace("]","").replace(/;/g,":"),r.ipv6uri=!0),r.pathNames=On(r,r.path),r.queryKey=Cn(r,r.query),r}function On(n,e){const t=/\/{2,9}/g,i=e.replace(t,"/").split("/");return(e.slice(0,1)=="/"||e.length===0)&&i.splice(0,1),e.slice(-1)=="/"&&i.splice(i.length-1,1),i}function Cn(n,e){const t={};return e.replace(/(?:^|&)([^&=]*)=?([^&]*)/g,function(i,s,r){s&&(t[s]=r)}),t}const Fe=typeof addEventListener=="function"&&typeof removeEventListener=="function",Ae=[];Fe&&addEventListener("offline",()=>{Ae.forEach(n=>n())},!1);class ae extends R{constructor(e,t){if(super(),this.binaryType=ln,this.writeBuffer=[],this._prevBufferLen=0,this._pingInterval=-1,this._pingTimeout=-1,this._maxPayload=-1,this._pingTimeoutTime=1/0,e&&typeof e=="object"&&(t=e,e=null),e){const i=He(e);t.hostname=i.host,t.secure=i.protocol==="https"||i.protocol==="wss",t.port=i.port,i.query&&(t.query=i.query)}else t.host&&(t.hostname=He(t.host).host);Ie(this,t),this.secure=t.secure!=null?t.secure:typeof location!="undefined"&&location.protocol==="https:",t.hostname&&!t.port&&(t.port=this.secure?"443":"80"),this.hostname=t.hostname||(typeof location!="undefined"?location.hostname:"localhost"),this.port=t.port||(typeof location!="undefined"&&location.port?location.port:this.secure?"443":"80"),this.transports=[],this._transportsByName={},t.transports.forEach(i=>{const s=i.prototype.name;this.transports.push(s),this._transportsByName[s]=i}),this.opts=Object.assign({path:"/engine.io",agent:!1,withCredentials:!1,upgrade:!0,timestampParam:"t",rememberUpgrade:!1,addTrailingSlash:!0,rejectUnauthorized:!0,perMessageDeflate:{threshold:1024},transportOptions:{},closeOnBeforeunload:!1},t),this.opts.path=this.opts.path.replace(/\/$/,"")+(this.opts.addTrailingSlash?"/":""),typeof this.opts.query=="string"&&(this.opts.query=gn(this.opts.query)),Fe&&(this.opts.closeOnBeforeunload&&(this._beforeunloadEventListener=()=>{this.transport&&(this.transport.removeAllListeners(),this.transport.close())},addEventListener("beforeunload",this._beforeunloadEventListener,!1)),this.hostname!=="localhost"&&(this._offlineEventListener=()=>{this._onClose("transport close",{description:"network connection lost"})},Ae.push(this._offlineEventListener))),this.opts.withCredentials&&(this._cookieJar=void 0),this._open()}createTransport(e){const t=Object.assign({},this.opts.query);t.EIO=ut,t.transport=e,this.id&&(t.sid=this.id);const i=Object.assign({},this.opts,{query:t,socket:this,hostname:this.hostname,secure:this.secure,port:this.port},this.opts.transportOptions[e]);return new this._transportsByName[e](i)}_open(){if(this.transports.length===0){this.setTimeoutFn(()=>{this.emitReserved("error","No transports available")},0);return}const e=this.opts.rememberUpgrade&&ae.priorWebsocketSuccess&&this.transports.indexOf("websocket")!==-1?"websocket":this.transports[0];this.readyState="opening";const t=this.createTransport(e);t.open(),this.setTransport(t)}setTransport(e){this.transport&&this.transport.removeAllListeners(),this.transport=e,e.on("drain",this._onDrain.bind(this)).on("packet",this._onPacket.bind(this)).on("error",this._onError.bind(this)).on("close",t=>this._onClose("transport close",t))}onOpen(){this.readyState="open",ae.priorWebsocketSuccess=this.transport.name==="websocket",this.emitReserved("open"),this.flush()}_onPacket(e){if(this.readyState==="opening"||this.readyState==="open"||this.readyState==="closing")switch(this.emitReserved("packet",e),this.emitReserved("heartbeat"),e.type){case"open":this.onHandshake(JSON.parse(e.data));break;case"ping":this._sendPacket("pong"),this.emitReserved("ping"),this.emitReserved("pong"),this._resetPingTimeout();break;case"error":const t=new Error("server error");t.code=e.data,this._onError(t);break;case"message":this.emitReserved("data",e.data),this.emitReserved("message",e.data);break}}onHandshake(e){this.emitReserved("handshake",e),this.id=e.sid,this.transport.query.sid=e.sid,this._pingInterval=e.pingInterval,this._pingTimeout=e.pingTimeout,this._maxPayload=e.maxPayload,this.onOpen(),this.readyState!=="closed"&&this._resetPingTimeout()}_resetPingTimeout(){this.clearTimeoutFn(this._pingTimeoutTimer);const e=this._pingInterval+this._pingTimeout;this._pingTimeoutTime=Date.now()+e,this._pingTimeoutTimer=this.setTimeoutFn(()=>{this._onClose("ping timeout")},e),this.opts.autoUnref&&this._pingTimeoutTimer.unref()}_onDrain(){this.writeBuffer.splice(0,this._prevBufferLen),this._prevBufferLen=0,this.writeBuffer.length===0?this.emitReserved("drain"):this.flush()}flush(){if(this.readyState!=="closed"&&this.transport.writable&&!this.upgrading&&this.writeBuffer.length){const e=this._getWritablePackets();this.transport.send(e),this._prevBufferLen=e.length,this.emitReserved("flush")}}_getWritablePackets(){if(!(this._maxPayload&&this.transport.name==="polling"&&this.writeBuffer.length>1))return this.writeBuffer;let t=1;for(let i=0;i<this.writeBuffer.length;i++){const s=this.writeBuffer[i].data;if(s&&(t+=un(s)),i>0&&t>this._maxPayload)return this.writeBuffer.slice(0,i);t+=2}return this.writeBuffer}_hasPingExpired(){if(!this._pingTimeoutTime)return!0;const e=Date.now()>this._pingTimeoutTime;return e&&(this._pingTimeoutTime=0,Te(()=>{this._onClose("ping timeout")},this.setTimeoutFn)),e}write(e,t,i){return this._sendPacket("message",e,t,i),this}send(e,t,i){return this._sendPacket("message",e,t,i),this}_sendPacket(e,t,i,s){if(typeof t=="function"&&(s=t,t=void 0),typeof i=="function"&&(s=i,i=null),this.readyState==="closing"||this.readyState==="closed")return;i=i||{},i.compress=i.compress!==!1;const r={type:e,data:t,options:i};this.emitReserved("packetCreate",r),this.writeBuffer.push(r),s&&this.once("flush",s),this.flush()}close(){const e=()=>{this._onClose("forced close"),this.transport.close()},t=()=>{this.off("upgrade",t),this.off("upgradeError",t),e()},i=()=>{this.once("upgrade",t),this.once("upgradeError",t)};return(this.readyState==="opening"||this.readyState==="open")&&(this.readyState="closing",this.writeBuffer.length?this.once("drain",()=>{this.upgrading?i():e()}):this.upgrading?i():e()),this}_onError(e){if(ae.priorWebsocketSuccess=!1,this.opts.tryAllTransports&&this.transports.length>1&&this.readyState==="opening")return this.transports.shift(),this._open();this.emitReserved("error",e),this._onClose("transport error",e)}_onClose(e,t){if(this.readyState==="opening"||this.readyState==="open"||this.readyState==="closing"){if(this.clearTimeoutFn(this._pingTimeoutTimer),this.transport.removeAllListeners("close"),this.transport.close(),this.transport.removeAllListeners(),Fe&&(this._beforeunloadEventListener&&removeEventListener("beforeunload",this._beforeunloadEventListener,!1),this._offlineEventListener)){const i=Ae.indexOf(this._offlineEventListener);i!==-1&&Ae.splice(i,1)}this.readyState="closed",this.id=null,this.emitReserved("close",e,t),this.writeBuffer=[],this._prevBufferLen=0}}}ae.protocol=ut;class Rn extends ae{constructor(){super(...arguments),this._upgrades=[]}onOpen(){if(super.onOpen(),this.readyState==="open"&&this.opts.upgrade)for(let e=0;e<this._upgrades.length;e++)this._probe(this._upgrades[e])}_probe(e){let t=this.createTransport(e),i=!1;ae.priorWebsocketSuccess=!1;const s=()=>{i||(t.send([{type:"ping",data:"probe"}]),t.once("packet",L=>{if(!i)if(L.type==="pong"&&L.data==="probe"){if(this.upgrading=!0,this.emitReserved("upgrading",t),!t)return;ae.priorWebsocketSuccess=t.name==="websocket",this.transport.pause(()=>{i||this.readyState!=="closed"&&(k(),this.setTransport(t),t.send([{type:"upgrade"}]),this.emitReserved("upgrade",t),t=null,this.upgrading=!1,this.flush())})}else{const w=new Error("probe error");w.transport=t.name,this.emitReserved("upgradeError",w)}}))};function r(){i||(i=!0,k(),t.close(),t=null)}const o=L=>{const w=new Error("probe error: "+L);w.transport=t.name,r(),this.emitReserved("upgradeError",w)};function c(){o("transport closed")}function l(){o("socket closed")}function x(L){t&&L.name!==t.name&&r()}const k=()=>{t.removeListener("open",s),t.removeListener("error",o),t.removeListener("close",c),this.off("close",l),this.off("upgrading",x)};t.once("open",s),t.once("error",o),t.once("close",c),this.once("close",l),this.once("upgrading",x),this._upgrades.indexOf("webtransport")!==-1&&e!=="webtransport"?this.setTimeoutFn(()=>{i||t.open()},200):t.open()}onHandshake(e){this._upgrades=this._filterUpgrades(e.upgrades),super.onHandshake(e)}_filterUpgrades(e){const t=[];for(let i=0;i<e.length;i++)~this.transports.indexOf(e[i])&&t.push(e[i]);return t}}let $n=class extends Rn{constructor(e,t={}){const i=typeof e=="object"?e:t;(!i.transports||i.transports&&typeof i.transports[0]=="string")&&(i.transports=(i.transports||["polling","websocket","webtransport"]).map(s=>In[s]).filter(s=>!!s)),super(e,i)}};function Bn(n,e="",t){let i=n;t=t||typeof location!="undefined"&&location,n==null&&(n=t.protocol+"//"+t.host),typeof n=="string"&&(n.charAt(0)==="/"&&(n.charAt(1)==="/"?n=t.protocol+n:n=t.host+n),/^(https?|wss?):\/\//.test(n)||(typeof t!="undefined"?n=t.protocol+"//"+n:n="https://"+n),i=He(n)),i.port||(/^(http|ws)$/.test(i.protocol)?i.port="80":/^(http|ws)s$/.test(i.protocol)&&(i.port="443")),i.path=i.path||"/";const r=i.host.indexOf(":")!==-1?"["+i.host+"]":i.host;return i.id=i.protocol+"://"+r+":"+i.port+e,i.href=i.protocol+"://"+r+(t&&t.port===i.port?"":":"+i.port),i}const Nn=typeof ArrayBuffer=="function",qn=n=>typeof ArrayBuffer.isView=="function"?ArrayBuffer.isView(n):n.buffer instanceof ArrayBuffer,vt=Object.prototype.toString,Pn=typeof Blob=="function"||typeof Blob!="undefined"&&vt.call(Blob)==="[object BlobConstructor]",Mn=typeof File=="function"||typeof File!="undefined"&&vt.call(File)==="[object FileConstructor]";function Ve(n){return Nn&&(n instanceof ArrayBuffer||qn(n))||Pn&&n instanceof Blob||Mn&&n instanceof File}function Le(n,e){if(!n||typeof n!="object")return!1;if(Array.isArray(n)){for(let t=0,i=n.length;t<i;t++)if(Le(n[t]))return!0;return!1}if(Ve(n))return!0;if(n.toJSON&&typeof n.toJSON=="function"&&arguments.length===1)return Le(n.toJSON(),!0);for(const t in n)if(Object.prototype.hasOwnProperty.call(n,t)&&Le(n[t]))return!0;return!1}function Dn(n){const e=[],t=n.data,i=n;return i.data=Ke(t,e),i.attachments=e.length,{packet:i,buffers:e}}function Ke(n,e){if(!n)return n;if(Ve(n)){const t={_placeholder:!0,num:e.length};return e.push(n),t}else if(Array.isArray(n)){const t=new Array(n.length);for(let i=0;i<n.length;i++)t[i]=Ke(n[i],e);return t}else if(typeof n=="object"&&!(n instanceof Date)){const t={};for(const i in n)Object.prototype.hasOwnProperty.call(n,i)&&(t[i]=Ke(n[i],e));return t}return n}function jn(n,e){return n.data=Ye(n.data,e),delete n.attachments,n}function Ye(n,e){if(!n)return n;if(n&&n._placeholder===!0){if(typeof n.num=="number"&&n.num>=0&&n.num<e.length)return e[n.num];throw new Error("illegal attachments")}else if(Array.isArray(n))for(let t=0;t<n.length;t++)n[t]=Ye(n[t],e);else if(typeof n=="object")for(const t in n)Object.prototype.hasOwnProperty.call(n,t)&&(n[t]=Ye(n[t],e));return n}const zn=["connect","connect_error","disconnect","disconnecting","newListener","removeListener"];var b;(function(n){n[n.CONNECT=0]="CONNECT",n[n.DISCONNECT=1]="DISCONNECT",n[n.EVENT=2]="EVENT",n[n.ACK=3]="ACK",n[n.CONNECT_ERROR=4]="CONNECT_ERROR",n[n.BINARY_EVENT=5]="BINARY_EVENT",n[n.BINARY_ACK=6]="BINARY_ACK"})(b||(b={}));class Un{constructor(e){this.replacer=e}encode(e){return(e.type===b.EVENT||e.type===b.ACK)&&Le(e)?this.encodeAsBinary({type:e.type===b.EVENT?b.BINARY_EVENT:b.BINARY_ACK,nsp:e.nsp,data:e.data,id:e.id}):[this.encodeAsString(e)]}encodeAsString(e){let t=""+e.type;return(e.type===b.BINARY_EVENT||e.type===b.BINARY_ACK)&&(t+=e.attachments+"-"),e.nsp&&e.nsp!=="/"&&(t+=e.nsp+","),e.id!=null&&(t+=e.id),e.data!=null&&(t+=JSON.stringify(e.data,this.replacer)),t}encodeAsBinary(e){const t=Dn(e),i=this.encodeAsString(t.packet),s=t.buffers;return s.unshift(i),s}}class We extends R{constructor(e){super(),this.opts=Object.assign({reviver:void 0,maxAttachments:10},typeof e=="function"?{reviver:e}:e)}add(e){let t;if(typeof e=="string"){if(this.reconstructor)throw new Error("got plaintext data when reconstructing a packet");t=this.decodeString(e);const i=t.type===b.BINARY_EVENT;i||t.type===b.BINARY_ACK?(t.type=i?b.EVENT:b.ACK,this.reconstructor=new Hn(t),t.attachments===0&&super.emitReserved("decoded",t)):super.emitReserved("decoded",t)}else if(Ve(e)||e.base64)if(this.reconstructor)t=this.reconstructor.takeBinaryData(e),t&&(this.reconstructor=null,super.emitReserved("decoded",t));else throw new Error("got binary data when not reconstructing a packet");else throw new Error("Unknown type: "+e)}decodeString(e){let t=0;const i={type:Number(e.charAt(0))};if(b[i.type]===void 0)throw new Error("unknown packet type "+i.type);if(i.type===b.BINARY_EVENT||i.type===b.BINARY_ACK){const r=t+1;for(;e.charAt(++t)!=="-"&&t!=e.length;);const o=e.substring(r,t);if(o!=Number(o)||e.charAt(t)!=="-")throw new Error("Illegal attachments");const c=Number(o);if(!Fn(c)||c<0)throw new Error("Illegal attachments");if(c>this.opts.maxAttachments)throw new Error("too many attachments");i.attachments=c}if(e.charAt(t+1)==="/"){const r=t+1;for(;++t&&!(e.charAt(t)===","||t===e.length););i.nsp=e.substring(r,t)}else i.nsp="/";const s=e.charAt(t+1);if(s!==""&&Number(s)==s){const r=t+1;for(;++t;){const o=e.charAt(t);if(o==null||Number(o)!=o){--t;break}if(t===e.length)break}i.id=Number(e.substring(r,t+1))}if(e.charAt(++t)){const r=this.tryParse(e.substr(t));if(We.isPayloadValid(i.type,r))i.data=r;else throw new Error("invalid payload")}return i}tryParse(e){try{return JSON.parse(e,this.opts.reviver)}catch(t){return!1}}static isPayloadValid(e,t){switch(e){case b.CONNECT:return wt(t);case b.DISCONNECT:return t===void 0;case b.CONNECT_ERROR:return typeof t=="string"||wt(t);case b.EVENT:case b.BINARY_EVENT:return Array.isArray(t)&&(typeof t[0]=="number"||typeof t[0]=="string"&&zn.indexOf(t[0])===-1);case b.ACK:case b.BINARY_ACK:return Array.isArray(t)}}destroy(){this.reconstructor&&(this.reconstructor.finishedReconstruction(),this.reconstructor=null)}}class Hn{constructor(e){this.packet=e,this.buffers=[],this.reconPack=e}takeBinaryData(e){if(this.buffers.push(e),this.buffers.length===this.reconPack.attachments){const t=jn(this.reconPack,this.buffers);return this.finishedReconstruction(),t}return null}finishedReconstruction(){this.reconPack=null,this.buffers=[]}}const Fn=Number.isInteger||function(n){return typeof n=="number"&&isFinite(n)&&Math.floor(n)===n};function wt(n){return Object.prototype.toString.call(n)==="[object Object]"}const Vn=Object.freeze(Object.defineProperty({__proto__:null,Decoder:We,Encoder:Un,get PacketType(){return b}},Symbol.toStringTag,{value:"Module"}));function W(n,e,t){return n.on(e,t),function(){n.off(e,t)}}const Kn=Object.freeze({connect:1,connect_error:1,disconnect:1,disconnecting:1,newListener:1,removeListener:1});class _t extends R{constructor(e,t,i){super(),this.connected=!1,this.recovered=!1,this.receiveBuffer=[],this.sendBuffer=[],this._queue=[],this._queueSeq=0,this.ids=0,this.acks={},this.flags={},this.io=e,this.nsp=t,i&&i.auth&&(this.auth=i.auth),this._opts=Object.assign({},i),this.io._autoConnect&&this.open()}get disconnected(){return!this.connected}subEvents(){if(this.subs)return;const e=this.io;this.subs=[W(e,"open",this.onopen.bind(this)),W(e,"packet",this.onpacket.bind(this)),W(e,"error",this.onerror.bind(this)),W(e,"close",this.onclose.bind(this))]}get active(){return!!this.subs}connect(){return this.connected?this:(this.subEvents(),this.io._reconnecting||this.io.open(),this.io._readyState==="open"&&this.onopen(),this)}open(){return this.connect()}send(...e){return e.unshift("message"),this.emit.apply(this,e),this}emit(e,...t){var i,s,r;if(Kn.hasOwnProperty(e))throw new Error('"'+e.toString()+'" is a reserved event name');if(t.unshift(e),this._opts.retries&&!this.flags.fromQueue&&!this.flags.volatile)return this._addToQueue(t),this;const o={type:b.EVENT,data:t};if(o.options={},o.options.compress=this.flags.compress!==!1,typeof t[t.length-1]=="function"){const k=this.ids++,L=t.pop();this._registerAckCallback(k,L),o.id=k}const c=(s=(i=this.io.engine)===null||i===void 0?void 0:i.transport)===null||s===void 0?void 0:s.writable,l=this.connected&&!(!((r=this.io.engine)===null||r===void 0)&&r._hasPingExpired());return this.flags.volatile&&!c||(l?(this.notifyOutgoingListeners(o),this.packet(o)):this.sendBuffer.push(o)),this.flags={},this}_registerAckCallback(e,t){var i;const s=(i=this.flags.timeout)!==null&&i!==void 0?i:this._opts.ackTimeout;if(s===void 0){this.acks[e]=t;return}const r=this.io.setTimeoutFn(()=>{delete this.acks[e];for(let c=0;c<this.sendBuffer.length;c++)this.sendBuffer[c].id===e&&this.sendBuffer.splice(c,1);t.call(this,new Error("operation has timed out"))},s),o=(...c)=>{this.io.clearTimeoutFn(r),t.apply(this,c)};o.withError=!0,this.acks[e]=o}emitWithAck(e,...t){return new Promise((i,s)=>{const r=(o,c)=>o?s(o):i(c);r.withError=!0,t.push(r),this.emit(e,...t)})}_addToQueue(e){let t;typeof e[e.length-1]=="function"&&(t=e.pop());const i={id:this._queueSeq++,tryCount:0,pending:!1,args:e,flags:Object.assign({fromQueue:!0},this.flags)};e.push((s,...r)=>(this._queue[0],s!==null?i.tryCount>this._opts.retries&&(this._queue.shift(),t&&t(s)):(this._queue.shift(),t&&t(null,...r)),i.pending=!1,this._drainQueue())),this._queue.push(i),this._drainQueue()}_drainQueue(e=!1){if(!this.connected||this._queue.length===0)return;const t=this._queue[0];t.pending&&!e||(t.pending=!0,t.tryCount++,this.flags=t.flags,this.emit.apply(this,t.args))}packet(e){e.nsp=this.nsp,this.io._packet(e)}onopen(){typeof this.auth=="function"?this.auth(e=>{this._sendConnectPacket(e)}):this._sendConnectPacket(this.auth)}_sendConnectPacket(e){this.packet({type:b.CONNECT,data:this._pid?Object.assign({pid:this._pid,offset:this._lastOffset},e):e})}onerror(e){this.connected||this.emitReserved("connect_error",e)}onclose(e,t){this.connected=!1,delete this.id,this.emitReserved("disconnect",e,t),this._clearAcks()}_clearAcks(){Object.keys(this.acks).forEach(e=>{if(!this.sendBuffer.some(i=>String(i.id)===e)){const i=this.acks[e];delete this.acks[e],i.withError&&i.call(this,new Error("socket has been disconnected"))}})}onpacket(e){if(e.nsp===this.nsp)switch(e.type){case b.CONNECT:e.data&&e.data.sid?this.onconnect(e.data.sid,e.data.pid):this.emitReserved("connect_error",new Error("It seems you are trying to reach a Socket.IO server in v2.x with a v3.x client, but they are not compatible (more information here: https://socket.io/docs/v3/migrating-from-2-x-to-3-0/)"));break;case b.EVENT:case b.BINARY_EVENT:this.onevent(e);break;case b.ACK:case b.BINARY_ACK:this.onack(e);break;case b.DISCONNECT:this.ondisconnect();break;case b.CONNECT_ERROR:this.destroy();const i=new Error(e.data.message);i.data=e.data.data,this.emitReserved("connect_error",i);break}}onevent(e){const t=e.data||[];e.id!=null&&t.push(this.ack(e.id)),this.connected?this.emitEvent(t):this.receiveBuffer.push(Object.freeze(t))}emitEvent(e){if(this._anyListeners&&this._anyListeners.length){const t=this._anyListeners.slice();for(const i of t)i.apply(this,e)}super.emit.apply(this,e),this._pid&&e.length&&typeof e[e.length-1]=="string"&&(this._lastOffset=e[e.length-1])}ack(e){const t=this;let i=!1;return function(...s){i||(i=!0,t.packet({type:b.ACK,id:e,data:s}))}}onack(e){const t=this.acks[e.id];typeof t=="function"&&(delete this.acks[e.id],t.withError&&e.data.unshift(null),t.apply(this,e.data))}onconnect(e,t){this.id=e,this.recovered=t&&this._pid===t,this._pid=t,this.connected=!0,this.emitBuffered(),this._drainQueue(!0),this.emitReserved("connect")}emitBuffered(){this.receiveBuffer.forEach(e=>this.emitEvent(e)),this.receiveBuffer=[],this.sendBuffer.forEach(e=>{this.notifyOutgoingListeners(e),this.packet(e)}),this.sendBuffer=[]}ondisconnect(){this.destroy(),this.onclose("io server disconnect")}destroy(){this.subs&&(this.subs.forEach(e=>e()),this.subs=void 0),this.io._destroy(this)}disconnect(){return this.connected&&this.packet({type:b.DISCONNECT}),this.destroy(),this.connected&&this.onclose("io client disconnect"),this}close(){return this.disconnect()}compress(e){return this.flags.compress=e,this}get volatile(){return this.flags.volatile=!0,this}timeout(e){return this.flags.timeout=e,this}onAny(e){return this._anyListeners=this._anyListeners||[],this._anyListeners.push(e),this}prependAny(e){return this._anyListeners=this._anyListeners||[],this._anyListeners.unshift(e),this}offAny(e){if(!this._anyListeners)return this;if(e){const t=this._anyListeners;for(let i=0;i<t.length;i++)if(e===t[i])return t.splice(i,1),this}else this._anyListeners=[];return this}listenersAny(){return this._anyListeners||[]}onAnyOutgoing(e){return this._anyOutgoingListeners=this._anyOutgoingListeners||[],this._anyOutgoingListeners.push(e),this}prependAnyOutgoing(e){return this._anyOutgoingListeners=this._anyOutgoingListeners||[],this._anyOutgoingListeners.unshift(e),this}offAnyOutgoing(e){if(!this._anyOutgoingListeners)return this;if(e){const t=this._anyOutgoingListeners;for(let i=0;i<t.length;i++)if(e===t[i])return t.splice(i,1),this}else this._anyOutgoingListeners=[];return this}listenersAnyOutgoing(){return this._anyOutgoingListeners||[]}notifyOutgoingListeners(e){if(this._anyOutgoingListeners&&this._anyOutgoingListeners.length){const t=this._anyOutgoingListeners.slice();for(const i of t)i.apply(this,e.data)}}}function he(n){n=n||{},this.ms=n.min||100,this.max=n.max||1e4,this.factor=n.factor||2,this.jitter=n.jitter>0&&n.jitter<=1?n.jitter:0,this.attempts=0}he.prototype.duration=function(){var n=this.ms*Math.pow(this.factor,this.attempts++);if(this.jitter){var e=Math.random(),t=Math.floor(e*this.jitter*n);n=(Math.floor(e*10)&1)==0?n-t:n+t}return Math.min(n,this.max)|0},he.prototype.reset=function(){this.attempts=0},he.prototype.setMin=function(n){this.ms=n},he.prototype.setMax=function(n){this.max=n},he.prototype.setJitter=function(n){this.jitter=n};class Je extends R{constructor(e,t){var i;super(),this.nsps={},this.subs=[],e&&typeof e=="object"&&(t=e,e=void 0),t=t||{},t.path=t.path||"/socket.io",this.opts=t,Ie(this,t),this.reconnection(t.reconnection!==!1),this.reconnectionAttempts(t.reconnectionAttempts||1/0),this.reconnectionDelay(t.reconnectionDelay||1e3),this.reconnectionDelayMax(t.reconnectionDelayMax||5e3),this.randomizationFactor((i=t.randomizationFactor)!==null&&i!==void 0?i:.5),this.backoff=new he({min:this.reconnectionDelay(),max:this.reconnectionDelayMax(),jitter:this.randomizationFactor()}),this.timeout(t.timeout==null?2e4:t.timeout),this._readyState="closed",this.uri=e;const s=t.parser||Vn;this.encoder=new s.Encoder,this.decoder=new s.Decoder,this._autoConnect=t.autoConnect!==!1,this._autoConnect&&this.open()}reconnection(e){return arguments.length?(this._reconnection=!!e,e||(this.skipReconnect=!0),this):this._reconnection}reconnectionAttempts(e){return e===void 0?this._reconnectionAttempts:(this._reconnectionAttempts=e,this)}reconnectionDelay(e){var t;return e===void 0?this._reconnectionDelay:(this._reconnectionDelay=e,(t=this.backoff)===null||t===void 0||t.setMin(e),this)}randomizationFactor(e){var t;return e===void 0?this._randomizationFactor:(this._randomizationFactor=e,(t=this.backoff)===null||t===void 0||t.setJitter(e),this)}reconnectionDelayMax(e){var t;return e===void 0?this._reconnectionDelayMax:(this._reconnectionDelayMax=e,(t=this.backoff)===null||t===void 0||t.setMax(e),this)}timeout(e){return arguments.length?(this._timeout=e,this):this._timeout}maybeReconnectOnOpen(){!this._reconnecting&&this._reconnection&&this.backoff.attempts===0&&this.reconnect()}open(e){if(~this._readyState.indexOf("open"))return this;this.engine=new $n(this.uri,this.opts);const t=this.engine,i=this;this._readyState="opening",this.skipReconnect=!1;const s=W(t,"open",function(){i.onopen(),e&&e()}),r=c=>{this.cleanup(),this._readyState="closed",this.emitReserved("error",c),e?e(c):this.maybeReconnectOnOpen()},o=W(t,"error",r);if(this._timeout!==!1){const c=this._timeout,l=this.setTimeoutFn(()=>{s(),r(new Error("timeout")),t.close()},c);this.opts.autoUnref&&l.unref(),this.subs.push(()=>{this.clearTimeoutFn(l)})}return this.subs.push(s),this.subs.push(o),this}connect(e){return this.open(e)}onopen(){this.cleanup(),this._readyState="open",this.emitReserved("open");const e=this.engine;this.subs.push(W(e,"ping",this.onping.bind(this)),W(e,"data",this.ondata.bind(this)),W(e,"error",this.onerror.bind(this)),W(e,"close",this.onclose.bind(this)),W(this.decoder,"decoded",this.ondecoded.bind(this)))}onping(){this.emitReserved("ping")}ondata(e){try{this.decoder.add(e)}catch(t){this.onclose("parse error",t)}}ondecoded(e){Te(()=>{this.emitReserved("packet",e)},this.setTimeoutFn)}onerror(e){this.emitReserved("error",e)}socket(e,t){let i=this.nsps[e];return i?this._autoConnect&&!i.active&&i.connect():(i=new _t(this,e,t),this.nsps[e]=i),i}_destroy(e){const t=Object.keys(this.nsps);for(const i of t)if(this.nsps[i].active)return;this._close()}_packet(e){const t=this.encoder.encode(e);for(let i=0;i<t.length;i++)this.engine.write(t[i],e.options)}cleanup(){this.subs.forEach(e=>e()),this.subs.length=0,this.decoder.destroy()}_close(){this.skipReconnect=!0,this._reconnecting=!1,this.onclose("forced close")}disconnect(){return this._close()}onclose(e,t){var i;this.cleanup(),(i=this.engine)===null||i===void 0||i.close(),this.backoff.reset(),this._readyState="closed",this.emitReserved("close",e,t),this._reconnection&&!this.skipReconnect&&this.reconnect()}reconnect(){if(this._reconnecting||this.skipReconnect)return this;const e=this;if(this.backoff.attempts>=this._reconnectionAttempts)this.backoff.reset(),this.emitReserved("reconnect_failed"),this._reconnecting=!1;else{const t=this.backoff.duration();this._reconnecting=!0;const i=this.setTimeoutFn(()=>{e.skipReconnect||(this.emitReserved("reconnect_attempt",e.backoff.attempts),!e.skipReconnect&&e.open(s=>{s?(e._reconnecting=!1,e.reconnect(),this.emitReserved("reconnect_error",s)):e.onreconnect()}))},t);this.opts.autoUnref&&i.unref(),this.subs.push(()=>{this.clearTimeoutFn(i)})}}onreconnect(){const e=this.backoff.attempts;this._reconnecting=!1,this.backoff.reset(),this.emitReserved("reconnect",e)}}const ye={};function Oe(n,e){typeof n=="object"&&(e=n,n=void 0),e=e||{};const t=Bn(n,e.path||"/socket.io"),i=t.source,s=t.id,r=t.path,o=ye[s]&&r in ye[s].nsps,c=e.forceNew||e["force new connection"]||e.multiplex===!1||o;let l;return c?l=new Je(i,e):(ye[s]||(ye[s]=new Je(i,e)),l=ye[s]),t.query&&!e.query&&(e.query=t.queryKey),l.socket(t.path,e)}Object.assign(Oe,{Manager:Je,Socket:_t,io:Oe,connect:Oe});function Yn(n,e,t){const i=n.apiBase||window.location.origin,s=Oe(i,{path:"/livechat-ws",auth:{siteKey:n.siteKey,visitorId:n.visitorId,sessionId:e},transports:["websocket","polling"],reconnection:!0,reconnectionDelay:600,reconnectionDelayMax:8e3});return s.on("livechat:event",r=>{r.sessionId===e&&t(r)}),s}const Wn=`
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
@media (max-width: 480px) {
  :host { bottom: 10px; right: 10px; }
  :host(.lc-position-left) { right: auto; left: 10px; }
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

.lc-msg { padding: 9px 13px; border-radius: 16px; font-size: 14px; line-height: 1.45; word-wrap: break-word; overflow-wrap: anywhere; }
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
@keyframes lc-spin { to { transform: rotate(360deg); } }
.lc-pending { display: flex; flex-wrap: wrap; gap: 6px; padding: 6px 12px 0 12px; background: #fff; flex-shrink: 0; }
.lc-chip { display: inline-flex; align-items: center; gap: 6px; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 10px; padding: 4px 8px; font-size: 12px; color: #1f2937; max-width: 240px; }
.lc-chip--busy { opacity: 0.85; border-style: dashed; }
.lc-chip-thumb { width: 36px; height: 36px; object-fit: cover; border-radius: 6px; flex-shrink: 0; }
.lc-chip-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lc-chip-uploading { color: #6b7280; }
.lc-spinner { display: inline-block; width: 12px; height: 12px; border: 2px solid #e5e7eb; border-top-color: #6b7280; border-radius: 50%; flex-shrink: 0; animation: lc-spin 0.8s linear infinite; }
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
/* .lc-composer .lc-attach-btn wins over .lc-composer button (specificity 0,2,0 > 0,1,1) */
.lc-composer .lc-attach-btn { background: transparent; border: 0; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #6b7280; cursor: pointer; flex-shrink: 0; }
.lc-composer .lc-attach-btn:hover { background: #f3f4f6; color: #1f2937; }
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

/* ── Streaming cursor ── */
.lc-msg--streaming {
  min-height: 1.4em;
}
.lc-msg--streaming::after {
  content: '';
  display: inline-block;
  width: 2px;
  height: 0.85em;
  background: currentColor;
  opacity: 0.6;
  margin-left: 2px;
  vertical-align: text-bottom;
  animation: lc-cursor-blink 0.55s steps(1) infinite;
}
@keyframes lc-cursor-blink {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 0; }
}

/* ── Incoming message preview popup ── */
.lc-msg-preview {
  position: absolute;
  bottom: 76px;
  right: 0;
  width: 280px;
  max-width: calc(100vw - 80px);
  background: #1e293b;
  color: #f1f5f9;
  border-radius: 18px 18px 4px 18px;
  box-shadow: 0 10px 32px rgba(15, 23, 42, 0.28), 0 2px 8px rgba(15, 23, 42, 0.12);
  padding: 12px 36px 12px 14px;
  font-size: 13px;
  line-height: 1.5;
  cursor: pointer;
  animation: lc-slide-in 0.25s ease;
  word-break: break-word;
}
:host(.lc-position-left) .lc-msg-preview {
  right: auto;
  left: 0;
  border-radius: 18px 18px 18px 4px;
}
.lc-msg-preview-close {
  position: absolute;
  top: 8px;
  right: 8px;
  background: transparent;
  border: 0;
  color: #94a3b8;
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
.lc-msg-preview-close:hover { color: #f1f5f9; background: rgba(255,255,255,0.1); }
.lc-msg-preview-text { display: block; }

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
  .lc-composer .lc-attach-btn {
    width: 44px;
    height: 44px;
  }
  .lc-composer .lc-emoji-btn {
    width: 44px;
    height: 44px;
  }
  .lc-composer button[type="submit"] {
    width: 44px;
    height: 44px;
  }
  /* Prevent double-tap zoom on all interactive elements. */
  .lc-close, .lc-menu-btn, .lc-newchat-btn,
  .lc-attach-btn, .lc-emoji-btn,
  .lc-composer button[type="submit"],
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
  /* Emoji picker: shrink grid so it doesn't overflow the compressed panel. */
  .lc-emoji-grid { max-height: 110px; }
}
/* Portrait + soft keyboard: medium-height viewport (keyboard visible but not landscape).
   Reduce picker height so it fits between the header and composer. */
@media (max-width: 480px) and (min-height: 401px) and (max-height: 600px) {
  .lc-emoji-grid { max-height: 150px; }
}
`,Xe=[{name:"Smileys",emojis:["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","😐","😑","😶","🙄","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🤐","🤨","😐","😑","😶","😏","😴","🤤","😪","😵","🤐","🥴","🤢","🤮","🤧","😷"]},{name:"Hearts",emojis:["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟"]},{name:"Hands",emojis:["👍","👎","👌","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","👋","🤚","🖐️","✋","🖖","👏","🙌","🤝","🙏","✍️","💪","🦾"]},{name:"Objects",emojis:["🔥","✨","🎉","🎊","🎁","🏆","🥇","⭐","🌟","💫","💥","💯","✅","❌","⚠️","❓","❗","💡","📌","📎","🔗","🔒","🔑","⏰","⏳","📅","📆","🗓️","📊","📈"]},{name:"Travel",emojis:["🚀","✈️","🚗","🚕","🚙","🚌","🏠","🏢","🏥","🏦","🏪","🏫","⛺","🌍","🌎","🌏","🗺️","🏖️","🏔️","🌋"]}],Jn=[[":)","🙂"],[":-)","🙂"],[":D","😄"],[":-D","😄"],["xD","😆"],["XD","😆"],[":P","😛"],[":p","😋"],[":-P","😛"],[":'(","😢"],[":(","🙁"],[":-(","🙁"],[";)","😉"],[";-)","😉"],[":O","😮"],[":o","😮"],[":-O","😮"],[":oO","😳"],[":|","😐"],[":-|","😐"],[":/","😕"],[":-/","😕"],["<3","❤️"],["</3","💔"],[":*","😘"],["B)","😎"]];function Xn(n){let e=n;for(const[t,i]of Jn){const s=t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),r=new RegExp(`(^|\\s)${s}(?=\\s|$|[.,!?])`,"g");e=e.replace(r,`$1${i}`)}return e}const Gn="https://gist.githubusercontent.com/Sharifur/b40c7b54b97d43f353f1382e51c70535/raw/f6446fa378bf266cacf604f1e97f8f318e01e157/temporary-email-address-domain-list.json",kt="livechat_disposable_domains",St="livechat_disposable_domains_ts",Qn=1440*60*1e3;let ce=null;async function Et(){if(ce)return ce;try{const n=localStorage.getItem(St),e=localStorage.getItem(kt),t=n?Number(n):0;if(e&&t&&Date.now()-t<Qn){const i=JSON.parse(e);return ce=new Set(i.map(s=>s.toLowerCase())),ce}}catch(n){}try{const n=new AbortController,e=setTimeout(()=>n.abort(),4e3),t=await fetch(Gn,{signal:n.signal});if(clearTimeout(e),t.ok){const i=await t.json(),r=(Array.isArray(i)?i:[]).map(o=>String(o).trim().toLowerCase()).filter(Boolean);ce=new Set(r);try{localStorage.setItem(kt,JSON.stringify(r)),localStorage.setItem(St,String(Date.now()))}catch(o){}return ce}}catch(n){}return ce=new Set(["mailinator.com","guerrillamail.com","10minutemail.com","tempmail.com","temp-mail.org","yopmail.com","trashmail.com","fakeinbox.com","throwawaymail.com","getairmail.com","sharklasers.com"]),ce}async function Zn(n){const e=n.lastIndexOf("@");if(e<0)return!1;const t=n.slice(e+1).trim().toLowerCase();return t?(await Et()).has(t):!1}function ei(){Et()}const ti={siteKey:"",botName:"Hi there",botSubtitle:"We typically reply in a few seconds.",welcomeMessage:null,brandColor:"#2563eb",position:"bottom-right"},Ce="livechat_messages_cache_v2",Tt="livechat_cache_bust",Ge="livechat_session_id",Qe="livechat_identify_dismissed",Re="livechat_identify_name",be="livechat_identify_email",It="livechat_send_log",$e="livechat_proactive_seen",ni=30,ii=6e4,si=3;function ri(n,e=ti){var Ne,pe,C;fi(n.siteKey,e.cacheBust);const t=Date.now(),i=document.createElement("div");i.id="livechat-widget-root";const s=()=>window.innerWidth<=480,r="10px",o="10px",c="position: fixed; bottom: 40px; right: 40px; z-index: 2147483646;",l=`position: fixed; bottom: ${r}; right: ${o}; z-index: 2147483646;`;i.style.cssText=s()?l:c,document.body.appendChild(i);const x=i.attachShadow({mode:"open"}),k=(Ne=gi(e.brandColor))!=null?Ne:"#2563eb",L=Rt(k,.35),w=Rt(k,.45);i.style.setProperty("--lc-brand",k),i.style.setProperty("--lc-brand-shadow",L),i.style.setProperty("--lc-brand-shadow-hover",w),e.position==="bottom-left"&&i.classList.add("lc-position-left");const M=document.createElement("style");M.textContent=Wn,x.appendChild(M);const K=()=>{i.style.setProperty("--lc-brand",k),i.style.setProperty("--lc-brand-shadow",L),i.style.setProperty("--lc-brand-shadow-hover",w)},p={open:!1,sessionId:hi(),messages:mi(),socket:null,panel:null,askedForEmail:!1,askedForName:!1,knownName:li(),unread:0,sessionClosed:!1,feedbackAsked:!1,operators:(pe=e.operators)!=null?pe:[],host:i,cfg:n,reapplyCssVars:K,activeDraftId:null,historyPushed:!1,pendingTrigger:void 0,closePanelAnim:void 0,collectPageContext:void 0,requireEmail:(C=e.requireEmail)!=null?C:!1},D=document.createElement("button");D.className="lc-bubble",D.innerHTML=Si(),x.appendChild(D);const _=document.createElement("span");_.className="lc-unread",_.style.display="none",D.appendChild(_);const u=document.createElement("div");if(u.className="lc-proactive",u.style.display="none",e.welcomeMessage){u.innerHTML=`
      <button class="lc-proactive-close" aria-label="Dismiss">&#x2715;</button>
      <div class="lc-proactive-text">${$(e.welcomeMessage)}</div>
    `,x.appendChild(u);let g=!1;try{g=!!sessionStorage.getItem($e)}catch(B){}g||setTimeout(()=>{p.open||(u.style.display="block")},1500),u.querySelector(".lc-proactive-close").addEventListener("click",B=>{B.stopPropagation(),u.style.display="none";try{sessionStorage.setItem($e,"1")}catch(X){}}),u.querySelector(".lc-proactive-text").addEventListener("click",()=>{u.style.display="none";try{sessionStorage.setItem($e,"1")}catch(B){}D.click()})}const N=document.createElement("div");N.className="lc-msg-preview",N.style.display="none",N.innerHTML='<button class="lc-msg-preview-close" aria-label="Dismiss">&#x2715;</button><span class="lc-msg-preview-text"></span>',x.appendChild(N);let q=null;function se(g){if(p.open)return;const B=g.replace(/__[a-z_]+__/g,"").trim();if(!B)return;const X=B.length>90?B.slice(0,87)+"...":B,le=N.querySelector(".lc-msg-preview-text");le&&(le.textContent=X),N.style.display="block",q&&clearTimeout(q),q=setTimeout(()=>{N.style.display="none"},6e3)}N.addEventListener("click",g=>{if(g.target.closest(".lc-msg-preview-close")){N.style.display="none",q&&(clearTimeout(q),q=null);return}N.style.display="none",p.open=!0,ue()}),p.messages.length===0&&e.welcomeMessage&&(p.messages.push({id:"welcome",role:"agent",content:e.welcomeMessage,createdAt:new Date().toISOString()}),de(p.messages));const O=oi(x,n,p,we,e);O.style.display="none",p.panel=O,O._state=p,O._cfg=n;function U(){const g=window.visualViewport;g?i.style.cssText=`position: fixed; top: ${g.offsetTop}px; left: ${g.offsetLeft}px; width: ${g.width}px; height: ${g.height}px; z-index: 2147483646;`:i.style.cssText="position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 2147483646;",K()}let h=null;function T(){h!==null&&cancelAnimationFrame(h),h=requestAnimationFrame(()=>{h=null,p.open&&(s()?U():(i.style.cssText=c,K()))})}let ee=!1;function J(){ee||!window.visualViewport||(ee=!0,window.visualViewport.addEventListener("resize",T),window.visualViewport.addEventListener("scroll",T),window.addEventListener("orientationchange",()=>{setTimeout(T,150)}))}window.addEventListener("popstate",()=>{p.open&&p.historyPushed&&(p.historyPushed=!1,fe())});function re(){var B,X,le,G;const g={};try{const I=document.body.scrollHeight-window.innerHeight;g.scrollDepth=I>0?Math.round(window.scrollY/I*100):100}catch(I){}g.timeOnPageSec=Math.round((Date.now()-t)/1e3);try{const I=(X=(B=document.querySelector("h1"))==null?void 0:B.textContent)==null?void 0:X.trim().slice(0,100);I&&(g.pageH1=I)}catch(I){}try{const I=(G=(le=document.querySelector('meta[name="description"]'))==null?void 0:le.content)==null?void 0:G.trim().slice(0,200);I&&(g.metaDescription=I)}catch(I){}try{const I=new URLSearchParams(window.location.search);I.get("utm_source")&&(g.utmSource=I.get("utm_source").slice(0,80)),I.get("utm_campaign")&&(g.utmCampaign=I.get("utm_campaign").slice(0,80)),I.get("utm_medium")&&(g.utmMedium=I.get("utm_medium").slice(0,80)),I.get("utm_term")&&(g.utmTerm=I.get("utm_term").slice(0,80))}catch(I){}try{document.referrer&&(g.referrerDomain=new URL(document.referrer).hostname.slice(0,100))}catch(I){}try{g.isReturnVisitor=!!localStorage.getItem("livechat_session_id")}catch(I){}return p.pendingTrigger&&(g.triggeredBy=p.pendingTrigger.slice(0,100),p.pendingTrigger=void 0),n.context&&Object.keys(n.context).length&&(g.custom=n.context),g}p.collectPageContext=re,document.addEventListener("click",g=>{var X;const B=g.target.closest("[data-lc-open]");B&&(g.preventDefault(),p.pendingTrigger=(X=B.getAttribute("data-lc-open"))!=null?X:void 0,p.open||(p.open=!0,ue()))});function ue(){var g;if(s()){U(),J();try{history.pushState({lcPanel:!0},""),p.historyPushed=!0}catch(B){}}O.classList.remove("lc-panel--closing"),O.style.display="flex",p.unread=0,_.style.display="none",N.style.display="none",q&&(clearTimeout(q),q=null),Lt(O),Ze(p),(g=O.querySelector("textarea"))==null||g.focus()}function fe(){p.open=!1,O.classList.add("lc-panel--closing"),setTimeout(()=>{p.open||(O.style.display="none",s()&&(i.style.cssText=l,K())),O.classList.remove("lc-panel--closing")},180)}p.closePanelAnim=fe,D.addEventListener("click",()=>{u.style.display="none";try{sessionStorage.setItem($e,"1")}catch(g){}if(p.open=!p.open,p.open)ue();else{if(p.historyPushed){p.historyPushed=!1;try{history.back()}catch(g){}}fe()}}),p.showMsgPreview=se,p.sessionId&&At(n,p,we,e),ei();function we(){ai(O,p),!p.open&&p.unread>0?(_.textContent=String(Math.min(p.unread,99)),_.style.display="flex"):_.style.display="none"}we()}function oi(n,e,t,i,s){var Ht,Ft,Vt,Kt;const r=document.createElement("div");r.className="lc-panel";const c=((Ht=s.operators)!=null?Ht:[]).length>1?((Ft=s.botName)==null?void 0:Ft.trim())||s.operatorName||"Chat with us":((Vt=s.operatorName)==null?void 0:Vt.trim())||s.botName;r.innerHTML=`
    <div class="lc-header">
      <div class="lc-header-top">
        <div class="lc-header-inner">
          ${Ci((Kt=s.operators)!=null?Kt:[],s.operatorName)}
          <div class="lc-header-text">
            <div class="lc-header-title">${$(c)}</div>
          </div>
        </div>
        <div class="lc-header-actions">
          <button class="lc-newchat-btn" aria-label="Start new conversation">${Oi()}</button>
          <button class="lc-menu-btn" aria-label="Conversation menu" aria-haspopup="true">${Ti()}</button>
          <div class="lc-menu" role="menu" style="display:none;">
            <button class="lc-menu-item" data-action="new">${Ii()} Start a new conversation</button>
            <button class="lc-menu-item" data-action="close">${Ai()} End this chat</button>
          </div>
          <button class="lc-close" aria-label="Close">${$t()}</button>
        </div>
      </div>
      <div class="lc-header-sub-row">
        <span class="lc-online-dot"></span>${$(s.botSubtitle)}
      </div>
    </div>
    <div class="lc-messages-wrap">
      <div class="lc-messages"></div>
      <button class="lc-scroll-btn" type="button" style="display:none;" aria-label="Scroll to latest">${$t()} New messages</button>
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
      <button type="button" class="lc-attach-btn" aria-label="Attach file">${_i()}</button>
      <button type="button" class="lc-emoji-btn" aria-label="Insert emoji">${Li()}</button>
      <div class="lc-emoji-pop" style="display:none;" role="dialog" aria-label="Emoji picker">
        <div class="lc-emoji-tabs">${Xe.map((a,d)=>`<button type="button" class="lc-emoji-tab${d===0?" lc-emoji-tab-active":""}" data-cat="${d}">${a.name}</button>`).join("")}</div>
        <div class="lc-emoji-grid">${Xe[0].emojis.map(a=>`<button type="button" class="lc-emoji-pick" data-emoji="${a}">${a}</button>`).join("")}</div>
      </div>
      <textarea placeholder="Type your message…" rows="1"></textarea>
      <button type="submit" aria-label="Send">${Bt()}</button>
    </form>
  `,n.appendChild(r);const x=t.host.classList.contains("lc-position-left")?"position: fixed; bottom: 10px; left: 10px; z-index: 2147483646;":"position: fixed; bottom: 10px; right: 10px; z-index: 2147483646;";r.querySelector(".lc-newchat-btn").addEventListener("click",()=>{confirm("Start a new conversation? The current chat will be cleared.")&&pe()}),r.querySelector(".lc-close").addEventListener("click",()=>{if(t.historyPushed){t.historyPushed=!1;try{history.back()}catch(a){}}if(t.closePanelAnim){t.closePanelAnim();return}t.open=!1,r.classList.add("lc-panel--closing"),setTimeout(()=>{var a;r.style.display="none",window.innerWidth<=480&&(t.host.style.cssText=x,(a=t.reapplyCssVars)==null||a.call(t)),r.classList.remove("lc-panel--closing")},180)});const w=r.querySelector(".lc-menu-btn"),M=r.querySelector(".lc-menu"),K=()=>{M.style.display="none"};w.addEventListener("click",a=>{a.stopPropagation(),M.style.display=M.style.display==="none"?"block":"none"}),r.addEventListener("click",a=>{!M.contains(a.target)&&a.target!==w&&K()}),M.addEventListener("click",async a=>{const d=a.target.closest(".lc-menu-item");if(!d)return;K();const f=d.getAttribute("data-action");if(f==="new"){if(!confirm("Start a new conversation? The current chat will be cleared."))return;pe()}else if(f==="close"){if(!confirm("End this chat? You can always start a new one."))return;const v=t.sessionId;if(v)try{await fetch(`${e.apiBase}/livechat/session/${encodeURIComponent(v)}/close`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({siteKey:e.siteKey,visitorId:e.visitorId}),credentials:"omit"})}catch(m){}pe(),t.messages=[{id:`system-${Date.now()}`,role:"system",content:"Chat ended. Type a message to start a new conversation.",createdAt:new Date().toISOString()}],de(t.messages),i()}});const p=r.querySelector(".lc-messages"),D=r.querySelector(".lc-scroll-btn");p.addEventListener("scroll",()=>{const a=p.scrollHeight-p.scrollTop-p.clientHeight;D.style.display=a>120?"flex":"none"}),D.addEventListener("click",()=>{p.scrollTop=p.scrollHeight,D.style.display="none"});const _=r.querySelector(".lc-composer"),u=r.querySelector("textarea"),N=r.querySelector(".lc-hp"),q=r.querySelector('.lc-composer button[type="submit"]'),se=r.querySelector(".lc-attach-btn"),O=r.querySelector(".lc-file-input"),U=r.querySelector(".lc-pending"),h=r.querySelector(".lc-quick-replies"),T=r.querySelector(".lc-session-end"),ee=r.querySelector(".lc-session-end-btn"),J=r.querySelector(".lc-emoji-btn"),re=r.querySelector(".lc-emoji-pop"),ue=r.querySelector(".lc-emoji-tabs"),fe=r.querySelector(".lc-emoji-grid");function we(a){var m,S;const d=(m=u.selectionStart)!=null?m:u.value.length,f=(S=u.selectionEnd)!=null?S:d;u.value=u.value.slice(0,d)+a+u.value.slice(f);const v=d+a.length;u.setSelectionRange(v,v),u.focus()}function Ne(a){const d=Xe[a];d&&(fe.innerHTML=d.emojis.map(f=>`<button type="button" class="lc-emoji-pick" data-emoji="${f}">${f}</button>`).join(""))}J.addEventListener("click",a=>{a.stopPropagation(),re.style.display=re.style.display==="none"?"block":"none"}),r.addEventListener("click",a=>{a.target instanceof Node&&!re.contains(a.target)&&a.target!==J&&(re.style.display="none")}),ue.addEventListener("click",a=>{var f;const d=a.target.closest(".lc-emoji-tab");d&&(ue.querySelectorAll(".lc-emoji-tab").forEach(v=>v.classList.remove("lc-emoji-tab-active")),d.classList.add("lc-emoji-tab-active"),Ne(Number((f=d.getAttribute("data-cat"))!=null?f:0)))}),fe.addEventListener("click",a=>{var f;const d=a.target.closest(".lc-emoji-pick");d&&we((f=d.getAttribute("data-emoji"))!=null?f:"")}),u.addEventListener("input",()=>{var f;const a=u.value,d=Xn(a);if(d!==a){const v=d.length-a.length,m=((f=u.selectionStart)!=null?f:a.length)+v;u.value=d,u.setSelectionRange(m,m)}});function pe(){var a;(a=t.socket)==null||a.disconnect(),t.socket=null,t.sessionId=null,t.sessionClosed=!1,t.messages=[],t.askedForEmail=!1,t.unread=0;try{localStorage.removeItem(Ge)}catch(d){}try{localStorage.removeItem(Ce)}catch(d){}try{localStorage.removeItem(Qe)}catch(d){}T.style.display="none",u.disabled=!1,q.disabled=!1,se.disabled=!1,s!=null&&s.welcomeMessage&&(t.messages.push({id:"welcome",role:"agent",content:s.welcomeMessage,createdAt:new Date().toISOString()}),de(t.messages)),i()}ee.addEventListener("click",pe);const C=[],g=Date.now();let B=!1;u.addEventListener("keydown",()=>{B=!0}),u.addEventListener("input",()=>{B=!0});function X(a){u.value=a,B=!0,_.requestSubmit()}r._submitFromChip=X;const le=()=>{var v;const a=t.messages.some(m=>m.role==="visitor"),d=/\b(talk|speak|connect|chat)\b.*\b(human|agent|person|representative|support team)\b|\b(human|live agent|real person)\b/i,f=((v=s.welcomeQuickReplies)!=null?v:[]).filter(Boolean).filter(m=>!d.test(m));if(a||f.length===0){h.style.display="none",h.innerHTML="";return}h.style.display="flex",h.innerHTML=f.map((m,S)=>`<button data-i="${S}" type="button">${$(m)}</button>`).join(""),h.querySelectorAll("button").forEach(m=>{m.addEventListener("click",()=>{const S=Number(m.dataset.i),P=f[S];P&&X(P)})})};se.addEventListener("click",()=>O.click()),O.addEventListener("change",async()=>{var v;const a=(v=O.files)==null?void 0:v[0];if(O.value="",!a)return;if(a.size>10*1024*1024){V(r,`File too large: ${a.name} (max 10 MB)`);return}if(C.length>=5){V(r,"You can attach up to 5 files per message.");return}if(!t.sessionId){V(r,"Send a message first, then attach files.");return}const d=a.type.startsWith("image/")?URL.createObjectURL(a):void 0,f={id:"pending-"+Date.now(),mimeType:a.type,sizeBytes:a.size,originalFilename:a.name,url:"",localUrl:d};C.push(f),G();try{const m=await j(e,t.sessionId,a),S=C.indexOf(f);S>=0&&(C[S]=me(oe({},m),{localUrl:d})),G()}catch(m){const S=C.indexOf(f);S>=0&&C.splice(S,1),d&&URL.revokeObjectURL(d),V(r,`Upload failed: ${m.message}`),G()}});function G(){if(!C.length){U.style.display="none",U.innerHTML="";return}U.style.display="flex",U.innerHTML=C.map((a,d)=>{var y;const f=a.id.startsWith("pending-"),v=(y=a.localUrl)!=null?y:"",S=a.mimeType.startsWith("image/")&&v?`<img class="lc-chip-thumb" src="${$(v)}" alt="">`:"",P=f?`${S}<span class="lc-chip-label lc-chip-uploading">Uploading…</span><span class="lc-spinner"></span>`:`${S}<span class="lc-chip-label">${$(a.originalFilename)}</span><button data-i="${d}" aria-label="Remove">×</button>`;return`<span class="lc-chip${f?" lc-chip--busy":""}">${P}</span>`}).join(""),U.querySelectorAll("button[data-i]").forEach(a=>{a.addEventListener("click",()=>{const d=Number(a.dataset.i),f=C.splice(d,1)[0];f!=null&&f.localUrl&&URL.revokeObjectURL(f.localUrl),G()})})}let I=null,zt=!1;const _e=a=>{var d;zt!==a&&(zt=a,(d=t.socket)==null||d.emit("livechat:typing",{on:a}))};u.addEventListener("input",()=>{u.style.height="auto",u.style.height=Math.min(120,u.scrollHeight)+"px",u.value.trim()?(_e(!0),I&&clearTimeout(I),I=setTimeout(()=>_e(!1),1500)):_e(!1)}),u.addEventListener("blur",()=>_e(!1)),u.addEventListener("keydown",a=>{a.key==="Enter"&&!a.shiftKey&&(a.preventDefault(),_.requestSubmit())}),u.addEventListener("paste",async a=>{var v;const d=(v=a.clipboardData)==null?void 0:v.items;if(!d)return;const f=[];for(const m of d)if(m.kind==="file"&&m.type.startsWith("image/")){const S=m.getAsFile();S&&f.push(S)}if(f.length){if(a.preventDefault(),!t.sessionId){V(r,"Send a message first, then paste images.");return}for(const m of f){if(m.size>10*1024*1024){V(r,`Pasted image too large: ${m.name||"image"} (max 10 MB)`);continue}if(C.length>=5)break;const S=m.name?m:new File([m],`pasted-${Date.now()}.png`,{type:m.type}),P=URL.createObjectURL(S),y={id:"pending-"+Math.random().toString(36).slice(2),mimeType:m.type,sizeBytes:m.size,originalFilename:S.name,url:"",localUrl:P};C.push(y),G();try{const A=await j(e,t.sessionId,S),E=C.indexOf(y);E>=0&&(C[E]=me(oe({},A),{localUrl:P})),G()}catch(A){const E=C.indexOf(y);E>=0&&C.splice(E,1),URL.revokeObjectURL(P),V(r,`Upload failed: ${A.message}`),G()}}}}),_.addEventListener("submit",async a=>{var m,S,P;if(a.preventDefault(),N.value)return;if(t.sessionClosed){V(r,"This conversation has ended. Start a new chat below.");return}const d=u.value.trim(),f=C.some(y=>y.id.startsWith("pending-")),v=C.filter(y=>y.url&&!y.id.startsWith("pending-"));if(f){V(r,"Your image is still uploading — please wait a moment.");return}if(!(!d&&!v.length)){if(!pi()){V(r,"Slow down — too many messages in the last minute.");return}if(s.requireEmail){let y=!1;try{const A=localStorage.getItem(be);y=A==="saved"||!!A&&A!=="skipped"}catch(A){}if(!y&&t.messages.some(E=>E.role==="visitor")){V(r,"Please enter your email to continue.");const E=r.querySelector('.lc-inline-identify[data-step="email"] .lc-inline-input');E&&E.focus();return}}q.disabled=!0,u.value="",u.style.height="auto",_e(!1),di(t,d,v),C.length=0,G(),le(),i(),Ot(r);try{const y=await Qt(e,d,v.map(A=>A.id),{hp:N.value||void 0,elapsedMs:Date.now()-g,hadInteraction:B},(S=(m=t.collectPageContext)==null?void 0:m.call(t))!=null?S:{});if(xe(r),t.sessionId=y.sessionId,ui(y.sessionId),"content"in y.agent&&y.agent.content){const A=(P=y.agent.id)!=null?P:"";if(!t.socket)et(t,y.agent.content,A);else{const E=y.agent.content;setTimeout(()=>{t.messages.some(ne=>ne.id===A)||!!t.activeDraftId||(et(t,E,A),i())},250)}}if(t.socket||At(e,t,i,s),s.requireEmail){let A=!1;try{const E=localStorage.getItem(be);A=E==="saved"||!!E&&E!=="skipped"}catch(E){}A||t.messages.some(te=>te.id==="identify-email"||te.id==="identify-email-done")||(t.messages.push({id:"identify-email",role:"agent",content:"__identify_email__",createdAt:new Date().toISOString()}),i())}else ci(r,t,i)}catch(y){xe(r),V(r,"Could not send — please try again.")}q.disabled=!1,i()}});const Ut=r.querySelector(".lc-messages");return Ut.addEventListener("click",async a=>{var m,S;const d=a.target,f=d.closest(".lc-inline-skip");if(f){const P=f.getAttribute("data-step");if(P==="name")try{localStorage.setItem(Re,"skipped")}catch(y){}else if(P==="email")try{localStorage.setItem(be,"skipped")}catch(y){}t.messages=t.messages.filter(y=>y.id!==`identify-${P}`),i();return}const v=d.closest(".lc-inline-save");if(v){const P=v.getAttribute("data-step"),y=v.closest(".lc-inline-identify"),A=y==null?void 0:y.querySelector("input"),E=(S=(m=A==null?void 0:A.value)==null?void 0:m.trim())!=null?S:"";if(P==="name"){if(!E)return;try{await st(e,{name:E}),t.knownName=E;try{localStorage.setItem(Re,E)}catch(ne){}const te=t.messages.findIndex(ne=>ne.id==="identify-name");te>=0&&(t.messages[te]={id:"identify-name-done",role:"system",content:`Nice to meet you, ${E}!`,createdAt:new Date().toISOString()}),i()}catch(te){}}else if(P==="email"){const te=ne=>{var Yt;A==null||A.classList.add("lc-inline-input--invalid");let ie=y==null?void 0:y.querySelector(".lc-inline-error");!ie&&y&&(ie=document.createElement("div"),ie.className="lc-inline-error",(Yt=y.querySelector(".lc-inline-row"))==null||Yt.after(ie)),ie&&(ie.textContent=ne)};if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(E)){te("That doesn't look right — double-check?");return}if(await Zn(E)){te("Please use a permanent email — we can’t follow up on temporary inboxes.");return}try{await st(e,{email:E});try{localStorage.setItem(be,"saved")}catch(ie){}try{localStorage.setItem(Qe,"saved")}catch(ie){}const ne=t.messages.findIndex(ie=>ie.id==="identify-email");ne>=0&&(t.messages[ne]={id:"identify-email-done",role:"system",content:`Great — we'll reach out at ${E} if we miss you here.`,createdAt:new Date().toISOString()}),i()}catch(ne){}}}}),Ut.addEventListener("keydown",a=>{const d=a;if(d.key!=="Enter")return;const f=d.target;if(!f.matches(".lc-inline-identify input"))return;d.preventDefault();const v=f.closest(".lc-inline-identify"),m=v==null?void 0:v.querySelector(".lc-inline-save");m==null||m.click()}),le(),r}function Ze(n){if(!n.open||!n.socket)return;n._seenIds||(n._seenIds=new Set);const e=n.messages.filter(t=>(t.role==="agent"||t.role==="operator")&&!n._seenIds.has(t.id)).map(t=>t.id);e.length&&(e.forEach(t=>n._seenIds.add(t)),n.socket.emit("livechat:messages_seen",{messageIds:e}))}function At(n,e,t,i){!e.sessionId||e.socket||(e.socket=Yn(n,e.sessionId,s=>{var l,x,k,L,w,M,K,p,D,_,u,N,q,se,O,U;if(s.type==="typing"){const h=e.panel;if(!h)return;s.on?Ot(h):xe(h);return}if(s.type==="session_status"&&s.status==="closed"){(l=e.socket)==null||l.disconnect(),e.socket=null,e.sessionClosed=!0;const h=e.panel;if(h){const T=h.querySelector(".lc-session-end"),ee=h.querySelector("textarea"),J=h.querySelector('.lc-composer button[type="submit"]'),re=h.querySelector(".lc-attach-btn");T&&(T.style.display="flex"),ee&&(ee.disabled=!0),J&&(J.disabled=!0),re&&(re.disabled=!0),e.feedbackAsked||(e.feedbackAsked=!0,e.messages.push({id:`feedback-${Date.now()}`,role:"system",content:"__feedback__",createdAt:new Date().toISOString()}))}t();return}if(s.type==="agent_stream_start"&&s.draftId){const h=e.panel;h&&xe(h),e.messages.some(T=>T.id===s.draftId)||(e.activeDraftId=s.draftId,e.messages.push({id:s.draftId,role:"agent",content:"",createdAt:(x=s.createdAt)!=null?x:new Date().toISOString()}),t());return}if(s.type==="agent_stream_delta"&&s.draftId&&s.delta){const h=e.messages.findIndex(T=>T.id===s.draftId);if(h>=0){e.messages[h]=me(oe({},e.messages[h]),{content:e.messages[h].content+s.delta});const T=e.panel,ee=T==null?void 0:T.querySelector(".lc-msg--streaming");if(ee){ee.textContent=e.messages[h].content;const J=T==null?void 0:T.querySelector(".lc-messages");J&&(J.scrollTop=J.scrollHeight)}else t()}return}if(s.type==="agent_stream_end"&&s.draftId&&s.messageId){e.activeDraftId=null;const h=e.messages.findIndex(T=>T.id===s.draftId);if(e.messages.some(T=>T.id===s.messageId)){h>=0&&(e.messages.splice(h,1),de(e.messages),t());return}h>=0&&(e.messages[h]=me(oe({},e.messages[h]),{id:s.messageId,content:(k=s.content)!=null?k:e.messages[h].content}),de(e.messages),e.open?Ze(e):(e.unread=((L=e.unread)!=null?L:0)+1,Ct(),(M=e.showMsgPreview)==null||M.call(e,(w=s.content)!=null?w:e.messages[h].content)),t());return}if(s.type==="agent_suggestions"&&s.messageId&&((K=s.suggestions)!=null&&K.length)){const h=e.messages.findIndex(T=>T.id===s.messageId);h>=0&&(e.messages[h]=me(oe({},e.messages[h]),{suggestions:s.suggestions.slice(0,3)}),t());return}if(s.type!=="message"||!s.messageId||s.role==="visitor"||e.messages.some(h=>h.id===s.messageId))return;if(e.activeDraftId){const h=e.messages.findIndex(T=>T.id===e.activeDraftId);h>=0&&e.messages.splice(h,1),e.activeDraftId=null}const r=(p=s.operatorName)!=null?p:void 0,o=(N=s.operatorAvatarUrl)!=null?N:r&&(u=(_=(D=i==null?void 0:i.operators)==null?void 0:D.find(h=>h.name===r))==null?void 0:_.avatarUrl)!=null?u:void 0;et(e,(q=s.content)!=null?q:"",s.messageId,s.role==="operator",s.attachments,r,o);const c=e.panel;c&&xe(c),e.open?Ze(e):(e.unread=((se=e.unread)!=null?se:0)+1,Ct(),(U=e.showMsgPreview)==null||U.call(e,(O=s.content)!=null?O:"")),t()}))}function ai(n,e){const t=n.querySelector(".lc-messages");if(!t)return;if(e.messages.length===0){t.innerHTML='<div class="lc-empty">Send us a message — we will get right back to you.</div>';return}const i=(()=>{for(let s=e.messages.length-1;s>=0;s--){const r=e.messages[s];if(r.role==="agent"||r.role==="operator")return s;if(r.role==="visitor")return-1}return-1})();t.innerHTML=e.messages.map((s,r)=>{var p,D;if(s.content==="__identify_name__"||s.content==="__identify_email__"){const _=s.content==="__identify_name__",u=_?"name":"email",N=!_&&e.knownName?`<span class="lc-inline-greet">Thanks ${$(e.knownName)}! </span>`:"",q=_?"Mind if I get your name?":`${N}If we miss you here, what's the best email to follow up on?`,se=_?"Your name":"you@example.com",O=_?"text":"email",U=_?"given-name":"email";return`<div class="lc-msg-row lc-msg-row-agent">
          <div class="lc-msg-avatar lc-msg-avatar-ai">${Nt()}</div>
          <div class="lc-msg-body">
            <div class="lc-msg lc-msg-agent lc-inline-identify" data-step="${u}">
              <div class="lc-inline-prompt">${q}</div>
              <div class="lc-inline-row">
                <input type="${O}" class="lc-inline-input" placeholder="${se}" autocomplete="${U}" />
                <button type="button" class="lc-inline-save" data-step="${u}" aria-label="Save">${Bt()}</button>
              </div>
              ${_||!e.requireEmail?`<button type="button" class="lc-inline-skip" data-step="${u}">${_?"Skip":"Maybe later"}</button>`:""}
            </div>
          </div>
        </div>`}const o=s.content?s.role==="visitor"?bi(s.content):xi(s.content):"",c=((p=s.attachments)!=null?p:[]).map(yi).join(""),l=c?`<div class="lc-attachments">${c}</div>`:"",x=wi(s.createdAt),k=x?`<div class="lc-msg-time">${x}</div>`:"",L=r===i&&s.suggestions&&s.suggestions.length?`<div class="lc-chips">${s.suggestions.map(_=>`<button class="lc-chip" data-chip="${F(_)}">${$(_)}</button>`).join("")}</div>`:"";if(s.role==="system")return s.content==="__feedback__"?`<div class="lc-msg lc-msg-system lc-feedback" data-feedback-id="${F(s.id)}">
            <span>How was this chat?</span>
            <button class="lc-fb-btn" data-rating="up" aria-label="Good">👍</button>
            <button class="lc-fb-btn" data-rating="down" aria-label="Bad">👎</button>
          </div>`:`<div class="lc-msg lc-msg-system">${o}</div>`;if(s.role==="visitor")return`<div class="lc-msg-row lc-msg-row-visitor">
          <div class="lc-msg-body">
            <div class="lc-msg lc-msg-visitor">${o}${l}</div>
            ${k}
          </div>
        </div>`;const w=s.id&&s.id!=="welcome"?`<div class="lc-msg-rating" data-msg-id="${F(s.id)}">
            <button class="lc-rate-btn" data-rating="up" aria-label="Helpful">&#128077;</button>
            <button class="lc-rate-btn" data-rating="down" aria-label="Not helpful">&#128078;</button>
           </div>`:"";if(s.role==="operator"){const _=(D=s.operatorName)!=null?D:"Operator";return`<div class="lc-msg-row lc-msg-row-agent">
          ${s.operatorAvatarUrl?`<img class="lc-msg-avatar lc-msg-avatar-img" src="${F(s.operatorAvatarUrl)}" alt="${$(_)}" title="${$(_)}">`:`<div class="lc-msg-avatar lc-msg-avatar-op" title="${$(_)}">${$(tt(_))}</div>`}
          <div class="lc-msg-body">
            <div class="lc-msg-sender">${$(_)}</div>
            <div class="lc-msg lc-msg-agent">${o}${l}</div>
            ${k}
            ${L}
          </div>
        </div>`}const M=s.id===e.activeDraftId,K=M?" lc-msg--streaming":"";return`<div class="lc-msg-row lc-msg-row-agent">
        <div class="lc-msg-avatar lc-msg-avatar-ai">${Nt()}</div>
        <div class="lc-msg-body">
          <div class="lc-msg lc-msg-agent${K}">${M?$(s.content):o}${l}</div>
          ${k}
          ${L}
          ${w}
        </div>
      </div>`}).join(""),t.querySelectorAll(".lc-msg-rating").forEach(s=>{s.querySelectorAll(".lc-rate-btn").forEach(r=>{r.addEventListener("click",async()=>{var k,L,w;const o=r.getAttribute("data-rating"),c=(k=s.getAttribute("data-msg-id"))!=null?k:"",l=(w=(L=n._state)==null?void 0:L.sessionId)!=null?w:"",x=n._cfg;if(!(!c||!l||!x)){s.querySelectorAll(".lc-rate-btn").forEach(M=>M.disabled=!0),r.classList.add("lc-rate-btn--active");try{await fetch(`${x.apiBase}/livechat/session/${encodeURIComponent(l)}/message/${encodeURIComponent(c)}/rating`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({siteKey:x.siteKey,visitorId:x.visitorId,rating:o}),credentials:"omit"})}catch(M){}}})})}),t.querySelectorAll(".lc-chip").forEach(s=>{s.addEventListener("click",()=>{var c;const r=(c=s.getAttribute("data-chip"))!=null?c:"";if(!r)return;const o=n._submitFromChip;if(o)o(r);else{const l=n.querySelector("textarea"),x=n.querySelector(".lc-composer");if(!l||!x)return;l.value=r,l.dispatchEvent(new Event("input",{bubbles:!0})),x.requestSubmit()}})}),t.querySelectorAll(".lc-fb-btn").forEach(s=>{s.addEventListener("click",async()=>{const r=s.closest(".lc-feedback"),o=s.getAttribute("data-rating");if(!r||!o)return;const c=e.sessionId,l=e.cfg;if(c&&l)try{await fetch(`${l.apiBase}/livechat/session/${encodeURIComponent(c)}/feedback`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({siteKey:l.siteKey,visitorId:l.visitorId,rating:o}),credentials:"omit"})}catch(x){}r.innerHTML="<span>Thanks for the feedback!</span>"})}),Lt(n)}function Lt(n){const e=n.querySelector(".lc-messages");e&&(e.scrollTop=e.scrollHeight)}function Ot(n){const e=n.querySelector(".lc-messages");if(!e||e.querySelector(".lc-typing"))return;const t=document.createElement("div");t.className="lc-typing",t.innerHTML="<span></span><span></span><span></span>",e.appendChild(t),e.scrollTop=e.scrollHeight}function xe(n){n.querySelectorAll(".lc-typing").forEach(e=>e.remove())}function ci(n,e,t){let i=!1;try{i=!!localStorage.getItem(Qe)}catch(w){}const s=e.messages,r=s.filter(w=>w.role==="visitor").length,o=s.filter(w=>w.role==="agent").length;let c=null;try{c=localStorage.getItem(Re)}catch(w){}const l=!!c||!!e.knownName||i,x=s.some(w=>w.id==="identify-name"||w.id==="identify-name-done");!l&&!x&&o>=1&&(e.askedForName=!0,e.messages.push({id:"identify-name",role:"agent",content:"__identify_name__",createdAt:new Date().toISOString()}),t());let k=!1;try{k=!!localStorage.getItem(be)}catch(w){}const L=s.some(w=>w.id==="identify-email"||w.id==="identify-email-done");!k&&!i&&!L&&r>=si&&(e.askedForEmail=!0,e.messages.push({id:"identify-email",role:"agent",content:"__identify_email__",createdAt:new Date().toISOString()}),t())}function li(){try{const n=localStorage.getItem(Re);return!n||n==="saved"||n==="skipped"?null:n}catch(n){return null}}function di(n,e,t){n.messages.push({id:"local-"+Date.now(),role:"visitor",content:e,createdAt:new Date().toISOString(),attachments:t}),de(n.messages)}function et(n,e,t,i=!1,s,r,o){n.messages.push({id:t||"srv-"+Date.now(),role:i?"operator":"agent",content:e,createdAt:new Date().toISOString(),attachments:s,operatorName:r,operatorAvatarUrl:o}),de(n.messages)}function pi(){var n;try{const e=Date.now(),t=JSON.parse((n=localStorage.getItem(It))!=null?n:"[]").filter(i=>e-i<ii);return t.length>=ni?!1:(t.push(e),localStorage.setItem(It,JSON.stringify(t)),!0)}catch(e){return!0}}function hi(){try{return localStorage.getItem(Ge)}catch(n){return null}}function ui(n){try{localStorage.setItem(Ge,n)}catch(e){}}function fi(n,e){if(e)try{localStorage.getItem(`${Tt}_${n}`)!==e&&(localStorage.removeItem(Ce),localStorage.setItem(`${Tt}_${n}`,e))}catch(t){}}function mi(){try{const n=localStorage.getItem(Ce);return n?JSON.parse(n):[]}catch(n){return[]}}function de(n){try{localStorage.setItem(Ce,JSON.stringify(n.slice(-50)))}catch(e){}}function Ct(){try{const n=new(window.AudioContext||window.webkitAudioContext),e=n.createOscillator(),t=n.createGain();e.connect(t),t.connect(n.destination),e.type="sine",e.frequency.setValueAtTime(880,n.currentTime),e.frequency.setValueAtTime(1100,n.currentTime+.08),t.gain.setValueAtTime(.12,n.currentTime),t.gain.exponentialRampToValueAtTime(.001,n.currentTime+.35),e.start(n.currentTime),e.stop(n.currentTime+.35)}catch(n){}}function $(n){return n.replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}function gi(n){if(!n)return null;const e=n.trim();return/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(e)?e:null}function Rt(n,e){let t=n.replace("#","");t.length===3&&(t=t.split("").map(o=>o+o).join(""));const i=parseInt(t.slice(0,2),16),s=parseInt(t.slice(2,4),16),r=parseInt(t.slice(4,6),16);return`rgba(${i}, ${s}, ${r}, ${e})`}function yi(n){if(n.mimeType.startsWith("image/")&&n.url)return`<a href="${F(n.url)}" target="_blank" rel="noopener noreferrer"><img class="lc-attach-img" src="${F(n.url)}" alt="${F(n.originalFilename)}" /></a>`;const t=vi(n.sizeBytes);return`<a class="lc-attach-file" href="${n.url?F(n.url):"#"}" target="_blank" rel="noopener noreferrer">${ki()}<span>${$(n.originalFilename)}</span><span class="lc-attach-size">${t}</span></a>`}function bi(n){return $(n).replace(/(https?:\/\/[^\s<]+)/g,i=>{const s=i.match(/[.,;:!?)]+$/),r=s?s[0]:"",o=r?i.slice(0,-r.length):i;return`<a href="${F(o)}" target="_blank" rel="noopener noreferrer nofollow">${o}</a>${r}`}).replace(/\n/g,"<br>")}function xi(n){let e=$(n);const t=[];return e=e.replace(/`([^`\n]+)`/g,(i,s)=>(t.push(`<code class="lc-md-code">${s}</code>`),`\0C${t.length-1}\0`)),e=e.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,(i,s,r)=>`<a href="${F(r)}" target="_blank" rel="noopener noreferrer nofollow">${s}</a>`),e=e.replace(/\*\*([^*\n]+?)\*\*/g,"<strong>$1</strong>"),e=e.replace(/(^|[\s(])\*([^*\n]+?)\*(?=[\s.,;:!?)]|$)/g,"$1<em>$2</em>"),e=e.replace(/(^|[\s>])(https?:\/\/[^\s<]+)/g,(i,s,r)=>{const o=r.match(/[.,;:!?)]+$/),c=o?o[0]:"",l=c?r.slice(0,-c.length):r;return`${s}<a href="${F(l)}" target="_blank" rel="noopener noreferrer nofollow">${l}</a>${c}`}),e=e.replace(/ C(\d+) /g,(i,s)=>{var r;return(r=t[Number(s)])!=null?r:""}),e=e.replace(/\n/g,"<br>"),e}function F(n){return n.replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}function vi(n){return n<1024?`${n} B`:n<1024*1024?`${(n/1024).toFixed(0)} KB`:`${(n/1024/1024).toFixed(1)} MB`}function V(n,e,t=3500){const i=n.querySelector(".lc-toast");i&&(i.textContent=e,i.style.display="block",clearTimeout(i._timer),i._timer=setTimeout(()=>{i.style.display="none"},t))}function tt(n){return n.trim().split(/\s+/).map(e=>{var t;return(t=e[0])!=null?t:""}).join("").slice(0,2).toUpperCase()}function wi(n){try{const e=new Date(n);return isNaN(e.getTime())?"":e.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}catch(e){return""}}function _i(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 17.93 8.83l-8.58 8.57a2 2 0 1 1-2.83-2.83l8.49-8.48"/></svg>'}function ki(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>'}function Si(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'}function Ei(){return'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>'}function $t(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>'}function Bt(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>'}function Ti(){return'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="6" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="18" r="1.5"/></svg>'}function Ii(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15.5-6.36L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.36L3 16"/><path d="M3 21v-5h5"/></svg>'}function Ai(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'}function Li(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>'}function Nt(){return'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4M22 5h-4M4 17v2M5 18H3"/></svg>'}function Oi(){return'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>'}function Ci(n,e){return!n.length&&(e!=null&&e.trim())?`<div class="lc-header-avatars"><div class="lc-op-avatar lc-op-initials" style="z-index:3">${$(tt(e.trim()))}</div></div>`:n.length?`<div class="lc-header-avatars">${n.slice(0,3).map((s,r)=>{const o=r===0?"":"margin-left:-10px;",c=`z-index:${3-r};`;return s.avatarUrl?`<img class="lc-op-avatar" src="${F(s.avatarUrl)}" alt="${$(s.name)}" style="${c}${o}">`:`<div class="lc-op-avatar lc-op-initials" style="${c}${o}">${$(tt(s.name))}</div>`}).join("")}</div>`:`<div class="lc-header-avatar">${Ei()}</div>`}let qt="",ve=null,Be=null;const Ri=3e4;function $i(n){Pt(n),Ni(n),window.addEventListener("popstate",()=>nt(n)),window.addEventListener("pagehide",()=>{ve&&it(n,ve)}),Bi(n)}function Bi(n){const e=()=>{document.visibilityState==="visible"&&Gt(n,{url:location.href,title:document.title})};setInterval(e,Ri),document.addEventListener("visibilitychange",()=>{document.visibilityState==="visible"&&e()})}function Ni(n){const e={pushState:history.pushState,replaceState:history.replaceState};history.pushState=function(...t){const i=e.pushState.apply(this,t);return nt(n),i},history.replaceState=function(...t){const i=e.replaceState.apply(this,t);return nt(n),i}}function nt(n){Be&&clearTimeout(Be),Be=setTimeout(()=>Pt(n),300)}async function Pt(n){var t;Be=null;const e=location.pathname+location.search;if(e!==qt){qt=e,ve&&it(n,ve);try{ve=(t=(await Xt(n,{url:location.href,path:location.pathname,title:document.title,referrer:document.referrer,language:navigator.language})).pageviewId)!=null?t:null}catch(i){}}}const Mt="livechat_visitor_id";function qi(){const n=Pi();if(!n)return null;const e=n.getAttribute("data-site");if(!e)return null;const t=n.getAttribute("data-api")||Mi(n)||"",i=Di();let s;try{const r=n.getAttribute("data-context");r&&(s=JSON.parse(r))}catch(r){}try{const r=window.CortexLivechat;r!=null&&r.context&&typeof r.context=="object"&&(s=oe(oe({},s),r.context))}catch(r){}return{siteKey:e,visitorId:i,apiBase:t,context:s}}function Pi(){const n=document.querySelectorAll("script[data-site]");return n.length?n[n.length-1]:null}function Mi(n){if(!n.src)return null;try{const e=new URL(n.src);return`${e.protocol}//${e.host}`}catch(e){return null}}function Di(){try{const n=localStorage.getItem(Mt);if(n)return n;const e=Dt();return localStorage.setItem(Mt,e),e}catch(n){return Dt()}}function Dt(){if(typeof crypto!="undefined"&&crypto.randomUUID)return crypto.randomUUID();let n=Date.now();return"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,e=>{const t=(n+Math.random()*16)%16|0;return n=Math.floor(n/16),(e==="x"?t:t&3|8).toString(16)})}const jt="livechat_build",ji=["livechat_messages_cache","livechat_session_id","livechat_identify_dismissed","livechat_send_log","livechat_proactive_seen"];function zi(){try{localStorage.getItem(jt)!=="moyoje2x"&&(ji.forEach(n=>localStorage.removeItem(n)),localStorage.setItem(jt,"moyoje2x"))}catch(n){}}(function(){var i;if(typeof window=="undefined"||(i=window.__livechat__)!=null&&i.mounted)return;zi();const e=qi();if(!e)return;window.__livechat__={mounted:!0,siteKey:e.siteKey,visitorId:e.visitorId},$i(e);const t=async()=>{const s=await Y(e);ri(e,s!=null?s:void 0)};document.readyState==="loading"?document.addEventListener("DOMContentLoaded",t):t()})()})();
