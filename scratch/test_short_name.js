const getTherapistShortName = (fullName) => {
  if (!fullName) return '';
  const parts = fullName.split(/[\s　]+/);
  const baseName = parts[0];
  const kanjiMatch = baseName.match(/^([\u4e00-\u9faf]+)/);
  if (kanjiMatch && kanjiMatch[1]) {
    return kanjiMatch[1];
  }
  return baseName;
};

const testCases = [
  '山手のみみ',
  '橘なの',
  '加糖ももか',
  'あや',
  'アンズ',
  '山手 のみみ',
  '橘　なの',
  '七瀬えみり',
  'John Doe'
];

for (const tc of testCases) {
  console.log(`"${tc}" -> "${getTherapistShortName(tc)}"`);
}
