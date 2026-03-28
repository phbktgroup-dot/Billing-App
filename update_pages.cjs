const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'src', 'pages');

const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
  const filePath = path.join(pagesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace DateFilter inside PageHeader
  // We need to extract the DateFilter block and move it to the dateFilter prop of PageHeader
  
  const dateFilterRegex = /<DateFilter\s+filterType=\{filterType\}\s+setFilterType=\{setFilterType\}\s+day=\{day\}\s+setDay=\{setDay\}\s+year=\{year\}\s+setYear=\{setYear\}\s+customRange=\{customRange\}\s+setCustomRange=\{setCustomRange\}\s*\/>/g;
  
  if (content.match(dateFilterRegex)) {
    // Find PageHeader
    const pageHeaderRegex = /<PageHeader([\s\S]*?)>([\s\S]*?)<\/PageHeader>/g;
    
    content = content.replace(pageHeaderRegex, (match, p1, p2) => {
      if (p2.includes('<DateFilter')) {
        // Remove DateFilter from children
        const newChildren = p2.replace(dateFilterRegex, '');
        
        // Add dateFilter prop to PageHeader
        const dateFilterProp = `\n        dateFilter={\n          <DateFilter \n            filterType={filterType}\n            setFilterType={setFilterType}\n            day={day}\n            setDay={setDay}\n            year={year}\n            setYear={setYear}\n            customRange={customRange}\n            setCustomRange={setCustomRange}\n            iconOnly={true}\n          />\n        }`;
        
        // Check if there are other children left (ignoring whitespace and empty divs)
        const hasOtherChildren = newChildren.replace(/<div[^>]*>|<\/div>|\s/g, '').length > 0;
        
        if (hasOtherChildren) {
            return `<PageHeader${p1}${dateFilterProp}\n      >${newChildren}</PageHeader>`;
        } else {
            return `<PageHeader${p1}${dateFilterProp}\n      />`;
        }
      }
      return match;
    });
    
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
  }
}
