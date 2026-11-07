export const filters = ['Все эфиры', 'Бесплатные', 'Доступные мне', 'Не купленные'];
export const available = (episode, purchased) => episode.is_free || purchased.has(episode.order);
export function selectEpisodes(items, filter, purchased) {
  return items.filter(e => filter === filters[0] || (filter === filters[1] && e.is_free) || (filter === filters[2] && available(e,purchased)) || (filter === filters[3] && !available(e,purchased)));
}
export function destination(e, purchased, internal = false) {
  const open = available(e, purchased);
  const pageId = open ? e.access_page_id : e.purchase_page_id;
  if (internal && pageId) return 'https://t.me/post#' + encodeURIComponent(pageId);
  return open ? e.access_url : e.purchase_url;
}
// Repeated mirrored branches from the reference: crown, left/right/centre, root.
export function treeGeometry(count, width, heights) {
  if (!count) return {positions:[],links:[],height:120};
  const positions=[[width*.5,28]], links=[];
  let sideBottom=0;
  let parent=0, y=28+Math.max(60,heights[0]*.55+10);
  for(let i=1;i<count;){
    y=Math.max(y,sideBottom+10);
    const remaining=count-i;
    if(remaining===1){y=Math.max(y,positions[parent][1]+heights[parent]+10);positions.push([width*.5,y]);links.push([parent,i]);break;}
    const left=i++,right=i++;
    positions[left]=[width*.17,y];positions[right]=[width*.83,y];
    links.push([parent,left],[parent,right]);
    const branchHeight=Math.max(heights[left],heights[right]);
    sideBottom=y+branchHeight;
    if(i<count){const centre=i++;positions[centre]=[width*.5,Math.max(y+Math.max(60,branchHeight*.55+10),positions[parent][1]+heights[parent]+10)];links.push([parent,centre],[left,centre],[right,centre]);parent=centre;y=positions[centre][1]+Math.max(60,heights[centre]*.55+10);}
  }
  const height=Math.max(...positions.map((p,i)=>p[1]+heights[i]))+24;
  return {positions,links,height};
}
