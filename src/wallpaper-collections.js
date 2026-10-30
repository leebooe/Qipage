const utm = '?utm_source=qipage&utm_medium=referral';

export const TIME_PERIODS = [
  { id: 'morning', label: '早晨', hours: '05:00–10:00', collectionId: 'GD4aOSg4yQE' },
  { id: 'day', label: '白天', hours: '10:00–17:00', collectionId: 'o8uX55RbBPs' },
  { id: 'evening', label: '傍晚', hours: '17:00–20:00', collectionId: '3M2rKTckZaQ' },
  { id: 'night', label: '夜间', hours: '20:00–05:00', collectionId: 'bHDh4Ae7O8o' },
].map(period => ({ ...period, url: `https://unsplash.com/collections/${period.collectionId}${utm}` }));

export function timePeriod(date = new Date()) {
  const hour = date.getHours();
  return TIME_PERIODS[hour >= 5 && hour < 10 ? 0 : hour >= 10 && hour < 17 ? 1 : hour >= 17 && hour < 20 ? 2 : 3];
}

function photo(period, id, asset, title, author, username) {
  return {
    id, period, title, author,
    collectionId: TIME_PERIODS.find(item => item.id === period).collectionId,
    url: `https://images.unsplash.com/${asset}?auto=format&fit=crop&w=2560&q=85&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D`,
    authorUrl: `https://unsplash.com/@${username}${utm}`,
    pageUrl: `https://unsplash.com/photos/${id}${utm}`,
  };
}

// Selected from the four linked collections; original photo and author links are retained.
export const COLLECTION = [
  photo('morning', 'LyHhDhtzXOI', 'photo-1778236262726-452ab6686b0f', '晨雾中，热气球缓缓升起', 'Pascal Debrunner', 'debrupas'),
  photo('morning', 'Uu1MoLHczCo', 'photo-1746937807433-05748b80caf4', '晨光漫过山丘与薄雾', 'Zetong Li', 'zetong'),
  photo('morning', 'GFGwOqGGW7w', 'photo-1771241222039-facdf3435d73', '雪滴花上的清晨露珠', 'Pascal Debrunner', 'debrupas'),
  photo('morning', 'SvFFr464urs', 'photo-1739361133037-77be66a4ea6a', '沿着林间小路，慢慢出发', 'Ingmar', 'visualsbying'),
  photo('day', 'KH-YtOe9eRE', 'photo-1643387998818-5e2e86380d53', '海鸟掠过开阔水面', 'Pascal Debrunner', 'debrupas'),
  photo('day', 'BUm3ke-GfPQ', 'photo-1780664352571-d53c00c5fd12', '晴空下，雪山静静伫立', 'damien dufour', 'damiendufourphotographie'),
  photo('day', 'iqBc91jdqoQ', 'photo-1776679768423-114637549209', '碧海与沙岸相遇的地方', 'Rod Long', 'rodlong'),
  photo('day', '4a3q57L8idg', 'photo-1776785044825-57390a892be8', '把一抹蕨叶的绿，留给日常', 'Dmytro Koplyk', 'dkoplyk'),
  photo('evening', 'zHRlfpTGXx8', 'photo-1780498178879-4064b19e6517', '云霞染上富士山的轮廓', 'Jayesh Patel', 'jayescapes'),
  photo('evening', 'zMi8tT1bYJw', 'photo-1752137853855-e07bb8505eae', '群山消融在金色光影里', 'Filip Kvasnak', 'filipkvasnak'),
  photo('evening', 'MPJKSDnu5Ko', 'photo-1773630157723-e7965c9f3c38', '蓝与粉交织的温柔天色', 'YC Siu', 'mshaw_1234'),
  photo('evening', 'NOGMkRfcCbE', 'photo-1773609108583-4f0040c75e7f', '山坡上的鹿，停在柔光里', 'Ivan Nieto', 'ivnphoto'),
  photo('night', 'rTZW4f02zY8', 'photo-1462331940025-496dfbfc7564', '星云深处，安放今晚的思绪', 'NASA', 'nasa'),
  photo('night', 'aB5tmNaOsYA', 'photo-1777195680785-23dbb7768b60', '从月球望向远方的地球', 'NASA', 'nasa'),
  photo('night', '4vp5pFmr_9A', 'photo-1783638204102-c20f956b5663', '暮色中的雪山，渐渐安静', 'Slava Auchynnikau', 'auchynnikau'),
  photo('night', '7_q1mh7Ibvk', 'photo-1772415912163-bd5fe16b8ff0', '把今夜，交给一轮满月', 'Dmytro Koplyk', 'dkoplyk'),
];
