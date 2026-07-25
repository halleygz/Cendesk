export namespace croc {
	
	export class Event {
	    type: string;
	    direction?: string;
	    state?: string;
	    timestamp: number;
	    code?: string;
	    name?: string;
	    count?: number;
	    size?: number;
	    displaySize?: string;
	    percent?: number;
	    transferred?: string;
	    total?: string;
	    speed?: string;
	    eta?: string;
	    message?: string;
	    destination?: string;
	    stream?: string;
	
	    static createFrom(source: any = {}) {
	        return new Event(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.direction = source["direction"];
	        this.state = source["state"];
	        this.timestamp = source["timestamp"];
	        this.code = source["code"];
	        this.name = source["name"];
	        this.count = source["count"];
	        this.size = source["size"];
	        this.displaySize = source["displaySize"];
	        this.percent = source["percent"];
	        this.transferred = source["transferred"];
	        this.total = source["total"];
	        this.speed = source["speed"];
	        this.eta = source["eta"];
	        this.message = source["message"];
	        this.destination = source["destination"];
	        this.stream = source["stream"];
	    }
	}
	export class FileItem {
	    id: string;
	    name: string;
	    size: number;
	    type: string;
	    lastModified: number;
	    kind: string;
	    path: string;
	
	    static createFrom(source: any = {}) {
	        return new FileItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.size = source["size"];
	        this.type = source["type"];
	        this.lastModified = source["lastModified"];
	        this.kind = source["kind"];
	        this.path = source["path"];
	    }
	}
	export class Snapshot {
	    id: string;
	    direction: string;
	    state: string;
	    destination?: string;
	    events: Event[];
	
	    static createFrom(source: any = {}) {
	        return new Snapshot(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.direction = source["direction"];
	        this.state = source["state"];
	        this.destination = source["destination"];
	        this.events = this.convertValues(source["events"], Event);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

