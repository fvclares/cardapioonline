const fs = require('fs');

const content = fs.readFileSync('js/mock/initialData.js', 'utf8');

// Map of old Unsplash URLs to new GitHub raw URLs
const urlMap = {
  'https://images.unsplash.com/photo-1590947132387-155cc02f3212?auto=format&fit=crop&w=200&q=80': 'https://raw.githubusercontent.com/fvclares/cardapioonline/main/images/1590947132387-155cc02f3212.jpg',
  'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1200&q=80': 'https://raw.githubusercontent.com/fvclares/cardapioonline/main/images/1513104890138-7c749659a591.jpg',
  'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?auto=format&fit=crop&w=600&q=80': 'https://raw.githubusercontent.com/fvclares/cardapioonline/main/images/1549931319-a545dcf3bc73.jpg',
  'https://images.unsplash.com/photo-1579684947550-22e945225d9a?auto=format&fit=crop&w=600&q=80': 'https://raw.githubusercontent.com/fvclares/cardapioonline/main/images/1579684947550-22e945225d9a.jpg',
  'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&w=600&q=80': 'https://raw.githubusercontent.com/fvclares/cardapioonline/main/images/1541592106381-b31e9677c0e5.jpg',
  'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80': 'https://raw.githubusercontent.com/fvclares/cardapioonline/main/images/1589301760014-d929f3979dbc.jpg',
  'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?auto=format&fit=crop&w=600&q=80': 'https://raw.githubusercontent.com/fvclares/cardapioonline/main/images/1534308983496-4fabb1a015ee.jpg',
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=600&q=80': 'https://raw.githubusercontent.com/fvclares/cardapioonline/main/images/1565299624946-b28f40a0ae38.jpg',
  'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80': 'https://raw.githubusercontent.com/fvclares/cardapioonline/main/images/1513104890138-7c749659a591.jpg',
  'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=600&q=80': 'https://raw.githubusercontent.com/fvclares/cardapioonline/main/images/1604382354936-07c5d9983bd3.jpg',
  'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=600&q=80': 'https://raw.githubusercontent.com/fvclares/cardapioonline/main/images/1574071318508-1cdbab80d002.jpg',
  'https://images.unsplash.com/photo-1595854341625-f33ee10dbf94?auto=format&fit=crop&w=600&q=80': 'https://raw.githubusercontent.com/fvclares/cardapioonline/main/images/1595854341625-f33ee10dbf94.jpg',
  'https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=600&q=80': 'https://raw.githubusercontent.com/fvclares/cardapioonline/main/images/1628840042765-356cda07504e.jpg',
  'https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?auto=format&fit=crop&w=600&q=80': 'https://raw.githubusercontent.com/fvclares/cardapioonline/main/images/1571407970349-bc81e7e96d47.jpg',
  'https://images.unsplash.com/photo-1573821663912-569905455b1c?auto=format&fit=crop&w=600&q=80': 'https://raw.githubusercontent.com/fvclares/cardapioonline/main/images/1573821663912-569905455b1c.jpg',
  'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?auto=format&fit=crop&w=600&q=80': 'https://raw.githubusercontent.com/fvclares/cardapioonline/main/images/1593560708920-61dd98c46a4e.jpg',
  'https://images.unsplash.com/photo-1544982503-9f984c14501a?auto=format&fit=crop&w=600&q=80': 'https://raw.githubusercontent.com/fvclares/cardapioonline/main/images/1544982503-9f984c14501a.jpg',
  'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=600&q=80': 'https://raw.githubusercontent.com/fvclares/cardapioonline/main/images/1565299585323-38d6b0865b47.jpg',
  'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=600&q=80': 'https://raw.githubusercontent.com/fvclares/cardapioonline/main/images/1606313564200-e75d5e30476c.jpg',
  'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?auto=format&fit=crop&w=600&q=80': 'https://raw.githubusercontent.com/fvclares/cardapioonline/main/images/1541781774459-bb2af2f05b55.jpg',
  'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80': 'https://raw.githubusercontent.com/fvclares/cardapioonline/main/images/1622483767028-3f66f32aef97.jpg',
  'https://images.unsplash.com/photo-1527960471264-932f39eb5846?auto=format&fit=crop&w=600&q=80': 'https://raw.githubusercontent.com/fvclares/cardapioonline/main/images/1527960471264-932f39eb5846.jpg',
  'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=600&q=80': 'https://raw.githubusercontent.com/fvclares/cardapioonline/main/images/1613478223719-2ab802602423.jpg',
  'https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=600&q=80': 'https://raw.githubusercontent.com/fvclares/cardapioonline/main/images/1556881286-fc6915169721.jpg',
  'https://images.unsplash.com/photo-1608270191773-455b3941b2c4?auto=format&fit=crop&w=600&q=80': 'https://raw.githubusercontent.com/fvclares/cardapioonline/main/images/1608270191773-455b3941b2c4.jpg',
  'https://images.unsplash.com/photo-1584225065152-4a1454aa3d4e?auto=format&fit=crop&w=600&q=80': 'https://raw.githubusercontent.com/fvclares/cardapioonline/main/images/1584225065152-4a1454aa3d4e.jpg',
  'https://images.unsplash.com/photo-1560023907-5f339617ea30?auto=format&fit=crop&w=600&q=80': 'https://raw.githubusercontent.com/fvclares/cardapioonline/main/images/1560023907-5f339617ea30.jpg',
};

let newContent = content;
for (const [oldUrl, newUrl] of Object.entries(urlMap)) {
  newContent = newContent.replaceAll(oldUrl, newUrl);
}

fs.writeFileSync('js/mock/initialData.js', newContent);
console.log('URLs atualizadas com sucesso!');