'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function MobilePageContent() {
  const searchParams = useSearchParams();
  const [peerId, setPeerId] = useState('');
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState('');
  const [sentMessages, setSentMessages] = useState<string[]>([]);
  const [connectionStatus, setConnectionStatus] = useState('未连接');
  const peerRef = useRef<any>(null);
  const connectionRef = useRef<any>(null);
  const [autoFilled, setAutoFilled] = useState(false);

  useEffect(() => {
    // 从URL参数中获取ID
    const idFromUrl = searchParams.get('id');
    if (idFromUrl) {
      setPeerId(idFromUrl);
      setAutoFilled(true);
      // 可以选择自动触发连接
      // setTimeout(() => handleConnect(), 1000);
    }
  }, [searchParams]);

  const handleConnect = async () => {
    if (!peerId.trim()) {
      alert('请输入连接ID');
      return;
    }

    try {
      setConnectionStatus('正在连接...');
      
      // 动态导入simple-peer以避免SSR问题
      const { default: Peer } = await import('simple-peer');
      
      // 创建发起方Peer
      const peer = new Peer({
        initiator: true,
        trickle: false
      });

      peer.on('signal', async (data: any) => {
        console.log('生成信令数据:', data);
        // 将信令数据发送到电脑端
        try {
          // 这里应该有一个信令服务器来交换信令数据
          // 但为了简化，我们直接使用fetch API发送到电脑端
          const response = await fetch(`/api/signal?id=${peerId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
          });
          
          if (!response.ok) {
            throw new Error(`信令发送失败: ${response.status}`);
          }
          
          console.log('信令数据已发送到电脑端');
        } catch (error) {
          console.error('发送信令数据失败:', error);
          setConnectionStatus('连接失败: 无法发送信令数据');
        }
      });

      peer.on('connect', () => {
        console.log('连接已建立!');
        setConnected(true);
        setConnectionStatus('已连接');
      });

      peer.on('error', (err: any) => {
        console.error('连接错误:', err);
        setConnectionStatus('连接失败');
      });

      peerRef.current = peer;
      
      // 记录已处理的应答信令数据版本
      let processedVersion = 0;
      
      // 定期检查是否有新的应答信令数据
      const checkAnswerInterval = setInterval(async () => {
        if (connected) {
          console.log('已连接成功，停止检查应答信令数据');
          clearInterval(checkAnswerInterval);
          return;
        }
        
        try {
          console.log(`正在检查ID为${peerId}的应答信令数据...`);
          const answerResponse = await fetch(`/api/answer?id=${peerId}&version=${processedVersion}`);
          
          if (answerResponse.status === 404) {
            console.log(`ID为${peerId}的应答信令数据尚未准备好，等待中...`);
            return; // 继续等待下一次轮询
          }
          
          if (!answerResponse.ok) {
            console.error(`获取应答信令数据失败，状态码: ${answerResponse.status}`);
            return;
          }
          
          const answerData = await answerResponse.json();
          
          // 检查是否有更新
          if (answerData.noUpdate) {
            console.log('没有新的应答信令数据，继续等待...');
            return;
          }
          
          if (answerData.signal) {
            console.log('从API获取到应答信令数据:', answerData.signal);
            try {
              // 更新已处理的版本
              if (answerData.version) {
                processedVersion = answerData.version;
              }
              
              // 只有在连接未建立时才应用信令数据
              if (!connected) {
                peer.signal(answerData.signal);
                console.log('已将应答信令数据应用到Peer连接');
              } else {
                console.log('连接已建立，忽略新的应答信令数据');
              }
            } catch (signalError) {
              console.error('应用应答信令数据失败:', signalError);
            }
          } else {
            console.warn('API返回了成功状态，但没有应答信令数据');
          }
        } catch (error) {
          console.error('获取应答信令数据失败:', error);
        }
      }, 2000); // 每2秒检查一次
      
      return () => clearInterval(checkAnswerInterval);
    } catch (error) {
      console.error('初始化Peer失败:', error);
      setConnectionStatus('连接失败');
    }
  };

  const sendMessage = () => {
    if (!message.trim() || !peerRef.current || !connected) return;
    
    try {
      peerRef.current.send(message);
      setSentMessages(prev => [...prev, message]);
      setMessage('');
    } catch (error) {
      console.error('发送消息失败:', error);
    }
  };

  return (
    <div className="min-h-screen p-6 flex flex-col bg-gray-50">
      <h1 className="text-2xl font-bold mb-6 text-center text-gray-900">手机端 - 发送数据</h1>
      
      {!connected ? (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">连接到电脑</h2>
          
          <div className="mb-4">
            <label htmlFor="peerId" className="block text-sm font-medium text-gray-800 mb-1">连接ID</label>
            <input
              type="text"
              id="peerId"
              value={peerId}
              onChange={(e) => setPeerId(e.target.value)}
              className={`w-full px-3 py-2 border ${autoFilled ? 'border-green-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
              placeholder="输入电脑端显示的连接ID"
            />
            {autoFilled && (
              <p className="mt-1 text-sm text-green-700">✓ 已自动填充连接ID</p>
            )}
          </div>
          
          <button
            onClick={handleConnect}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            连接
          </button>
          
          <p className="mt-3 text-sm text-center text-gray-700">{connectionStatus}</p>
        </div>
      ) : (
        <div className="flex flex-col flex-grow">
          <div className="bg-green-100 text-green-800 p-3 rounded-md mb-4">
            <p className="font-semibold">✓ 已连接到电脑</p>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow-md mb-4 flex-grow">
            <h2 className="text-lg font-semibold mb-3 text-gray-800">已发送的消息</h2>
            <div className="border rounded-md h-48 overflow-y-auto mb-4 p-2">
              {sentMessages.length > 0 ? (
                <ul className="divide-y">
                  {sentMessages.map((msg, index) => (
                    <li key={index} className="py-2">
                      <p className="break-all text-gray-500">{msg}</p>
                      <p className="text-xs text-gray-500 mt-1">{new Date().toLocaleTimeString()}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-600 text-center mt-16">暂无发送记录</p>
              )}
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow-md sticky bottom-0">
            <div className="flex">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="flex-grow px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="输入要发送的文本"
              />
              <button
                onClick={sendMessage}
                className="bg-blue-500 text-white py-2 px-4 rounded-r-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                发送
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MobilePage() {
  return (
    <Suspense fallback={<div>加载中...</div>}>
      <MobilePageContent />
    </Suspense>
  );
}