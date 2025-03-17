import { NextResponse } from 'next/server';
import { networkInterfaces } from 'os';

export async function GET() {
  try {
    const nets = networkInterfaces();
    let localIp = '127.0.0.1';

    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        // 跳过内部IP和非IPv4地址
        if (!net.internal && net.family === 'IPv4') {
          localIp = net.address;
          break;
        }
      }
    }

    return NextResponse.json({ ip: localIp });
  } catch (error) {
    console.error('获取本地IP地址失败:', error);
    return NextResponse.json({ ip: '127.0.0.1' }, { status: 500 });
  }
}