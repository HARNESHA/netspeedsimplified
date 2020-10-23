const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Main = imports.ui.main;
const Gio = imports.gi.Gio;
const Mainloop = imports.mainloop;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

const PREFS_SCHEMA = 'org.gnome.shell.extensions.netspeedsimplified';
const refreshTime = 1.5; 

const rCConst = 3;

let settings;
let button, timeout;
let ioSpeed;
let lastCount = 0, lastSpeed = 0, lastCountUp = 0;
let mode; // 0: kb/s 1: KB/s 2: U:kb/s D:kb/s 3: U:KB/s D:KB/s 4: Total KB
let fontmode;
let resetNextCount = false, resetCount = 0;
let togglebool, reuseable_text, h = 8, newLine, tTime=0, useOldIcon = false;
var extRaw, rClickCount =0, isVertical, DIcons = [];

function init() {

    settings = Convenience.getSettings(PREFS_SCHEMA);

    mode = settings.get_int('mode'); // default mode using bit (b/s, kb/s)
    fontmode = settings.get_int('fontmode');
}

function changeMode(widget, event) {
    // log(event.get_button());
    if (event.get_button() == 3) {
        if (mode ==4 ){// right click: reset downloaded sum
        resetNextCount = true;
        parseStat();}
        else {//right click on other modes; brings total downloaded sum
          togglebool = !togglebool;
          ioSpeed.set_text("Loading Info...");
          button.set_child(chooseLabel());
          parseStat();
        }
	rClickCount++;
    }
    else if (event.get_button() == 2) { // change font
        fontmode++;
        if (fontmode > 4) fontmode=0;

        settings.set_int('fontmode', fontmode);
        button.set_child(chooseLabel());
        parseStat();
    }
    else if (event.get_button() == 1) {
        mode++;
        if (mode > 4) mode = 0;
        settings.set_int('mode', mode);
        button.set_child(chooseLabel(mode==4 ? true : false));
        parseStat();
    }
    log('mode:' + mode + ' font:' + fontmode);
}

function chooseLabel(addArg = false /*for mode 4*/) {
    styleName = (mode == 0 || mode == 1 || mode == 4) ? 'sumall' : 'upanddown'
    let extraw = '';
    (!isVertical) ? ((!addArg) ? (extraw = togglebool ? ' iwidth' : '') : null) : // Doesnt increase width on right click if mode==4 or if vertical is true
    ((mode ==2 || mode ==3) && togglebool ? extraw = ' leftlign' : null) // if vertical is true and right click is also true in mode 2,3 then make them left align
    styleName = 'forall ' + styleName + extraw + ' size'
    styleName = fontmode > 0 ? styleName + '-' + fontmode : styleName  
    
    ioSpeed.set_style_class_name(styleName);
    return ioSpeed;
}

function parseStat() {
    try {
        let input_file = Gio.file_new_for_path('/proc/net/dev');
        let fstream = input_file.read(null);
        let dstream = Gio.DataInputStream.new(fstream);

        let count = 0;
        let countUp = 0;
        let line;
	if (rClickCount != 0) tTime++;
	if(tTime>rCConst){
		tTime = 0;
		rClickCount = 0;
	}
	if (rClickCount>=rCConst){
	  	isVertical = !isVertical;
		rClickCount =0;
	}
	log("tTime  : " + tTime);
	log("rclickcounttttt  " + rClickCount);
        while (line = dstream.read_line(null)) {
            line = String(line);
            line = line.trim();
            let fields = line.split(/\W+/);
            if (fields.length<=2) break;

            if (fields[0] != "lo" && 
                !fields[0].match(/^virbr[0-9]+/) &&
                !fields[0].match(/^br[0-9]+/) &&
                !fields[0].match(/^vnet[0-9]+/) &&
                !fields[0].match(/^tun[0-9]+/) &&
                !fields[0].match(/^tap[0-9]+/) &&
                !isNaN(parseInt(fields[1]))) {
                    count = count + parseInt(fields[1]) + parseInt(fields[9]);
                    countUp = countUp + parseInt(fields[9]);
            }
        }
        fstream.close(null);

        if (lastCount === 0) lastCount = count;
        if (lastCountUp === 0) lastCountUp = countUp;

        let speed = (count - lastCount) / refreshTime;
        let speedUp = (countUp - lastCountUp) / refreshTime;
        let dot;
        dot = (speed > lastSpeed) ? "⇅" : ""
        if (resetNextCount == true) {
             resetNextCount = false;
             resetCount = count;
           }
	
        newLine = (isVertical && (mode ==2 || mode ==3)) ? "\n" : "";
        var speedy = speedToString(count - resetCount, 1);
        function sped(exta = extRaw, spda = speedy){ return exta + spda; }
        function commonSigma(thr = true /*If true will return a result else will return empty string*/, isnewline = false){
		let sigma = `${DIcons[2]} `;
		extRaw = "  |  " + sigma;
		if (thr && mode !=4){
            if ((mode ==0 || mode ==1)){
                (isVertical) ? (extRaw = "\n") + sigma : null
                 return (mode == 0) ? sped(extRaw, speedy.toLowerCase()) : sped(extRaw)
            }
            else if ((mode ==2 || mode ==3)) {
                (isVertical) ? (extRaw = "   " + sigma) + sigma : null
                return (mode == 2) ? sped(extRaw, speedy.toLowerCase()) : sped(extRaw)
            }
            else return "";
		}
		else if (mode == 4){ 
            return (isVertical) ? sped(sigma) + " -v" : sped(sigma)
        }
		else return "";
	}
	(speed || speedUp) ? h = 0 : h++
	if(h<=8){
		reuseable_text = (mode >= 0 && mode <= 1) ? `${dot} ${speedToString(speed)} ${commonSigma(togglebool)}` :
		(mode >= 2 && mode <= 3) ? `${DIcons[0]}   ${speedToString(speed - speedUp)} ${newLine}  ${DIcons[1]}   ${speedToString(speedUp)} ${commonSigma(togglebool)}` :
		(mode == 4) ? commonSigma(): "Mode Unavailable"
	}
	else{
    	ioSpeed.set_style_class_name("forall");
		if (mode !=4) reuseable_text = "--".repeat(mode+1) + newLine + commonSigma(togglebool, true);
		else reuseable_text =  commonSigma(togglebool);
    	}
	ioSpeed.set_text(reuseable_text);
        lastCount = count;
        lastCountUp = countUp;
        lastSpeed = speed;
    } catch (e) {
        ioSpeed.set_text(e.message);
    }
    return true;
}

function speedToString(amount, rMode = 0) {
    let digits;
    let speed_map;
    speed_map = ["B", "KB", "MB", "GB"].map(
	(rMode==1) ? v => v : //KB
    	(mode == 0 || mode == 2) ? v => v.toLowerCase() + "/s" : //kb/s
    	(mode == 1 || mode == 3) ? v => v + "/s" : v=>v) //KB/s
	
    if (amount === 0) return "0 "  + speed_map[0];
    if (mode==0 || mode==2) amount = amount * 8;

    let unit = 0;
    while (amount >= 1000) { // 1M=1024K, 1MB/s=1000MB/s
        amount /= 1000;
        ++unit;
    }
    function ChkifInt(amnt, digitsToFix = 1){
    	return Number.isInteger(parseFloat(amnt.toFixed(digitsToFix)));
    }
    digits = ChkifInt(amount) ? 0 : //For Integer like 21.0
     ((mode==4 || rMode !=0) && !ChkifInt(amount*10)) ? 2 /* For floats like 21.1 */ : 1 //For floats like 21.22

    return String(amount.toFixed(digits)) + " " + speed_map[unit];
}

function chooseIconSet(){
	DIcons = (useOldIcon) ? ["↓","↑","∑"] : ["🡳","🡱","Σ"]
}

function enable() {
    button = new St.Bin({
        style_class: 'panel-button',
        reactive: true,
        can_focus: true,
        x_fill: true,
        y_fill: false,
        x_expand: true,
        y_expand: false,
        track_hover: true
    });

    ioSpeed = new St.Label({
        text: '---',
        y_align: Clutter.ActorAlign.CENTER,
        style_class: 'forall'
    });
    button.set_child(chooseLabel());
    button.connect('button-press-event', changeMode);

    chooseIconSet();
	
    Main.panel._rightBox.insert_child_at_index(button, 0);
    timeout = Mainloop.timeout_add_seconds(refreshTime, parseStat);
}

function disable() {
    Mainloop.source_remove(timeout);
    Main.panel._rightBox.remove_child(button);
}
