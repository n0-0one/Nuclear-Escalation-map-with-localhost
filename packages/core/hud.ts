import type {HudMessage} from './types';

// Short English HUD names observed from the game. Exact matches only: player
// names and weapon kills must never be interpreted as a static unit identity.
const aliases:Record<string,string[]>={
  ussr_buk_m3_launcher:['"BUK-M3" (TELAR)'],ussr_buk_m3_fcs:['"BUK-M3" (FCS)'],
  sw_crotale_ng:['ItO 90M'],ussr_zprk_2s6:['2S6'],ussr_pantsyr_s1:['Pantsir-S1'],
  il_spyder_aio:['SPYDER'],cn_hq_11:['HQ11'],
  us_ai_aew_radar_tps_59:['AN/TPS-59 radar'],
};
export const hudName=(name:string)=>name.trim().toLocaleLowerCase('en-US');
export function unitHudNames(name:string,displayName:string,shortNames:string[]=[]){return [name,displayName,...shortNames,...(aliases[name.toLowerCase()]||[])].map(hudName);}
export function hudCombat(message:HudMessage){
  const match=/^(.+?) (destroyed|shot down|critically damaged|severely damaged|set afire) (.+)$/.exec(message.text);
  return match?{id:message.id,actor:hudName(match[1]),target:hudName(match[3]),destroyed:match[2]==='destroyed'||match[2]==='shot down'}:null;
}
