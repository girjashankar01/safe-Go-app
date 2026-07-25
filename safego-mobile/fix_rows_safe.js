const fs = require("fs");

function processFile(path) {
  let content = fs.readFileSync(path, "utf8");

  // ensure Pressable and Platform are imported
  if (!content.includes("Pressable")) {
    content = content.replace("TouchableOpacity,", "TouchableOpacity, Pressable, Platform,");
  }

  const replacements = [
    {
      old: `<TouchableOpacity style={styles.row} onPress={() => setPinMode('change_old')}>`,
      new: `<Pressable style={({ pressed }) => [styles.row, pressed && Platform.OS === 'ios' && { opacity: 0.7 }]} android_ripple={{ color: colors.primary + "20", borderless: false }} onPress={() => setPinMode('change_old')}>`
    },
    {
      old: `<TouchableOpacity style={styles.row} onPress={() => setPinMode('remove')}>`,
      new: `<Pressable style={({ pressed }) => [styles.row, pressed && Platform.OS === 'ios' && { opacity: 0.7 }]} android_ripple={{ color: colors.primary + "20", borderless: false }} onPress={() => setPinMode('remove')}>`
    },
    {
      old: `<TouchableOpacity style={styles.row} onPress={() => setPinMode('set')}>`,
      new: `<Pressable style={({ pressed }) => [styles.row, pressed && Platform.OS === 'ios' && { opacity: 0.7 }]} android_ripple={{ color: colors.primary + "20", borderless: false }} onPress={() => setPinMode('set')}>`
    },
    {
      old: `<TouchableOpacity style={styles.row} onPress={() => navigation.navigate('EmergencyAlarmSettings')}>`,
      new: `<Pressable style={({ pressed }) => [styles.row, pressed && Platform.OS === 'ios' && { opacity: 0.7 }]} android_ripple={{ color: colors.primary + "20", borderless: false }} onPress={() => navigation.navigate('EmergencyAlarmSettings')}>`
    },
    {
      old: `<TouchableOpacity style={styles.row} onPress={() => navigation.navigate('FakeCall')}>`,
      new: `<Pressable style={({ pressed }) => [styles.row, pressed && Platform.OS === 'ios' && { opacity: 0.7 }]} android_ripple={{ color: colors.primary + "20", borderless: false }} onPress={() => navigation.navigate('FakeCall')}>`
    },
    {
      old: `<TouchableOpacity style={styles.row} onPress={() => navigation.navigate('Profile')}>`,
      new: `<Pressable style={({ pressed }) => [styles.row, pressed && Platform.OS === 'ios' && { opacity: 0.7 }]} android_ripple={{ color: colors.primary + "20", borderless: false }} onPress={() => navigation.navigate('Profile')}>`
    },
    {
      old: `<TouchableOpacity style={styles.row} onPress={() => navigation.navigate('EmergencyHistory')}>`,
      new: `<Pressable style={({ pressed }) => [styles.row, pressed && Platform.OS === 'ios' && { opacity: 0.7 }]} android_ripple={{ color: colors.primary + "20", borderless: false }} onPress={() => navigation.navigate('EmergencyHistory')}>`
    },
    {
      old: `<TouchableOpacity style={styles.row} onPress={handleLogout}>`,
      new: `<Pressable style={({ pressed }) => [styles.row, pressed && Platform.OS === 'ios' && { opacity: 0.7 }]} android_ripple={{ color: colors.primary + "20", borderless: false }} onPress={handleLogout}>`
    },
  ];
  
  replacements.forEach(r => {
    if (content.includes(r.old)) {
      // replace opening tag
      content = content.replace(r.old, r.new);
      
      // replace the NEXT </TouchableOpacity> with </Pressable>
      let startIdx = content.indexOf(r.new);
      if (startIdx !== -1) {
        let endIdx = content.indexOf("</TouchableOpacity>", startIdx);
        if (endIdx !== -1) {
          content = content.substring(0, endIdx) + "</Pressable>" + content.substring(endIdx + 19);
        }
      }
    }
  });

  fs.writeFileSync(path, content);
  console.log("Processed", path);
}

processFile("screens/ProfileScreen.tsx");
