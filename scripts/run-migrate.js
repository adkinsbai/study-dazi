const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

async function main() {
  const prisma = new PrismaClient();
  const sql = fs.readFileSync(path.join(__dirname, 'migrate.sql'), 'utf-8');
  
  // Split by semicolons and execute each statement
  const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
  
  for (const stmt of statements) {
    try {
      await prisma.$executeRawUnsafe(stmt + ';');
      console.log('OK:', stmt.substring(0, 60).replace(/\n/g, ' ') + '...');
    } catch (err) {
      // Ignore "already exists" errors
      if (err.message?.includes('already exists') || err.message?.includes('duplicate')) {
        console.log('SKIP (exists):', stmt.substring(0, 60).replace(/\n/g, ' '));
      } else {
        console.error('FAIL:', err.message.substring(0, 100));
      }
    }
  }
  
  await prisma.$disconnect();
  console.log('Done!');
}

main().catch(e => { console.error(e.message); process.exit(1); });
