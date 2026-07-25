const fs = require("fs");
function processFile(path) {
  let content = fs.readFileSync(path, "utf8");

  // ensure Pressable and Platform are imported
  if (!content.includes("Pressable")) {
    content = content.replace("TouchableOpacity,", "TouchableOpacity, Pressable, Platform,");
  }

  const rowRegex = /<TouchableOpacity([^>]*style=\{styles\.row\}[^>]*)>([\s\S]*?)<\/TouchableOpacity>/g;
  const navRowRegex = /<TouchableOpacity([^>]*style=\{styles\.navRow\}[^>]*)>([\s\S]*?)<\/TouchableOpacity>/g;
  
  const replacer = (match, props, inner) => {
    let newProps = props.replace(/activeOpacity=\{[^}]+\}/g, "");
    
    // We'll use colors.text + "20" instead of "rgba(0,0,0,0.1)" for strict theming.
    let rippleProp = ` android_ripple={{ color: colors.text + "20", borderless: false }}`;
    
    // wrap style
    newProps = newProps.replace(/style=\{styles\.row\}/, `style={({ pressed }) => [styles.row, pressed && Platform.OS === 'ios' && { opacity: 0.7 }]}`);
    newProps = newProps.replace(/style=\{styles\.navRow\}/, `style={({ pressed }) => [styles.navRow, pressed && Platform.OS === 'ios' && { opacity: 0.7 }]}`);
    
    return `<Pressable${newProps}${rippleProp}>${inner}</Pressable>`;
  };
  
  content = content.replace(rowRegex, replacer);
  content = content.replace(navRowRegex, replacer);
  
  fs.writeFileSync(path, content);
  console.log("Processed", path);
}

processFile("screens/ProfileScreen.tsx");
