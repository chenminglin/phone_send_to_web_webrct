import { NextResponse } from 'next/server';

// 存储信令数据的临时对象
const signalStore: Record<string, any> = {};
// 记录已处理的信令数据版本
const processedSignalVersions: Record<string, number> = {};

// POST: 接收手机端发送的信令数据
export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: '缺少ID参数' }, { status: 400 });
    }
    
    const data = await request.json();
    signalStore[id] = data;
    
    console.log(`已存储ID为${id}的信令数据:`, data);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('处理信令数据失败:', error);
    return NextResponse.json({ error: '处理信令数据失败' }, { status: 500 });
  }
}

// GET: 电脑端获取对应ID的信令数据
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: '缺少ID参数' }, { status: 400 });
    }
    
    const signalData = signalStore[id];
    
    if (!signalData) {
      console.log(`客户端请求ID为${id}的信令数据，但未找到`);
      return NextResponse.json({ error: '未找到对应ID的信令数据' }, { status: 404 });
    }
    
    // 检查客户端是否已经处理过这个版本的信令数据
    const version = url.searchParams.get('version') || '0';
    const currentVersion = parseInt(version, 10);
    
    // 如果没有处理记录或者客户端请求的版本低于当前版本，返回信令数据
    if (!processedSignalVersions[id] || currentVersion < processedSignalVersions[id]) {
      console.log(`返回ID为${id}的信令数据给客户端，版本: ${processedSignalVersions[id] || 1}`);
      
      // 更新处理记录
      if (!processedSignalVersions[id]) {
        processedSignalVersions[id] = 1;
      }
      
      return NextResponse.json({ 
        signal: signalData,
        version: processedSignalVersions[id]
      });
    }
    
    // 客户端已经处理过这个版本的信令数据，返回无更新
    console.log(`客户端已处理ID为${id}的信令数据版本${currentVersion}，无需再次发送`);
    return NextResponse.json({ noUpdate: true });
  } catch (error) {
    console.error('获取信令数据失败:', error);
    return NextResponse.json({ error: '获取信令数据失败' }, { status: 500 });
  }
}