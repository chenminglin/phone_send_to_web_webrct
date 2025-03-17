'use client';

import { useEffect, useState, useRef } from 'react';
import { nanoid } from 'nanoid';
import QRCode from 'react-qr-code';
import Image from 'next/image';

export default function DesktopPage() {
  const [peerId, setPeerId] = useState('');
  const [connected, setConnected] = useState(false);
  const [receivedData, setReceivedData] = useState<string[]>([]);
  const [localIp, setLocalIp] = useState('');
  const peerRef = useRef<any>(null);
  const connectionRef = useRef<any>(null);

  useEffect(() => {
    // 动态导入simple-peer以避免SSR问题
    const initPeer = async () => {
      try {
        // 获取本地IP地址
        const response = await fetch('/api/get-local-ip');
        const data = await response.json();
        setLocalIp(data.ip);

        const { default: Peer } = await import('simple-peer');
        const id = nanoid(10);
        setPeerId(id);

        // 创建接收端Peer
        const peer = new Peer({
          initiator: false,
          trickle: false
        });

        peer.on('signal', async (data: any) => {
          // 当接收到offer后，生成answer信令数据
          console.log('生成应答信令数据:', data);
          
          // 将应答信令数据发送回手机端
          try {
            const response = await fetch(`/api/answer?id=${id}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(data),
            });
            
            if (!response.ok) {
              throw new Error(`应答信令发送失败: ${response.status}`);
            }
            
            console.log('应答信令数据已发送到服务器');
          } catch (error) {
            console.error('发送应答信令数据失败:', error);
          }
        });


        peer.on('connect', () => {
          console.log('连接已建立!');
          setConnected(true);
        });

        peer.on('data', (data: any) => {
          const receivedMessage = new TextDecoder().decode(data);
          console.log('接收到数据:', receivedMessage);
          setReceivedData(prev => [...prev, receivedMessage]);
        });

        peer.on('error', (err: any) => {
          console.error('WebRTC连接错误:', err);
        });

        peerRef.current = peer;
        
        // 记录已处理的信令数据版本
        let processedVersion = 0;
        
        // 定期检查是否有新的信令数据
        const checkSignalInterval = setInterval(async () => {
          if (connected) {
            console.log('已连接成功，停止检查信令数据');
            clearInterval(checkSignalInterval);
            return;
          }
          
          try {
            console.log(`正在检查ID为${id}的信令数据...`);
            const signalResponse = await fetch(`/api/signal?id=${id}&version=${processedVersion}`);
            
            if (signalResponse.status === 404) {
              console.log(`ID为${id}的信令数据尚未准备好，等待中...`);
              return; // 继续等待下一次轮询
            }
            
            if (!signalResponse.ok) {
              console.error(`获取信令数据失败，状态码: ${signalResponse.status}`);
              return;
            }
            
            const signalData = await signalResponse.json();
            
            // 检查是否有更新
            if (signalData.noUpdate) {
              console.log('没有新的信令数据，继续等待...');
              return;
            }
            
            if (signalData.signal) {
              console.log('从API获取到信令数据:', signalData.signal);
              try {
                // 更新已处理的版本
                if (signalData.version) {
                  processedVersion = signalData.version;
                }
                
                // 只有在连接未建立时才应用信令数据
                if (!connected) {
                  peer.signal(signalData.signal);
                  console.log('已将信令数据应用到Peer连接');
                } else {
                  console.log('连接已建立，忽略新的信令数据');
                }
              } catch (signalError) {
                console.error('应用信令数据失败:', signalError);
              }
            } else {
              console.warn('API返回了成功状态，但没有信令数据');
            }
          } catch (error) {
            console.error('获取信令数据失败:', error);
          }
        }, 2000); // 每2秒检查一次
        
        return () => clearInterval(checkSignalInterval);
      } catch (error) {
        console.error('初始化Peer失败:', error);
      }
    };

    initPeer();

    return () => {
      if (peerRef.current) {
        peerRef.current.destroy();
      }
    };
  }, []);

  const handleConnect = (offerData: string) => {
    try {
      if (peerRef.current) {
        const signal = JSON.parse(offerData);
        peerRef.current.signal(signal);
      }
    } catch (error) {
      console.error('连接失败:', error);
    }
  };

  return (
    <div className="min-h-screen p-8 flex flex-col items-center justify-center">
      <h1 className="text-3xl font-bold mb-8 text-gray-100">电脑端 - 接收数据</h1>
      
      {!connected ? (
        <div className="flex flex-col items-center bg-white p-8 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">连接步骤</h2>
          <ol className="list-decimal list-inside mb-6 text-left text-gray-900">
            <li className="mb-2">在手机上访问: <span className="font-mono bg-gray-100 p-1 rounded text-gray-900">{process.env.NEXT_PUBLIC_USE_LOCAL_IP === 'true' ? `http://${localIp}:3000/mobile` : `https://${process.env.NEXT_PUBLIC_DOMAIN}/mobile`}</span></li>
            <li className="mb-2">输入下方的连接ID</li>
            <li>点击"连接"按钮</li>
          </ol>
          
          <div className="bg-gray-100 p-4 rounded-md mb-6 w-full text-center">
            <p className="font-mono text-lg break-all text-gray-900">{peerId}</p>
          </div>
          
          <div className="text-center">
            <p className="text-sm text-gray-900 mb-2">或者扫描二维码访问手机端</p>
            {localIp && (
              <div className="bg-white p-4 inline-block">
                <QRCode value={process.env.NEXT_PUBLIC_USE_LOCAL_IP === 'true' ? `http://${localIp}:3000/mobile?id=${peerId}` : `https://${process.env.NEXT_PUBLIC_DOMAIN}/mobile?id=${peerId}`} size={200} />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="w-full max-w-2xl">
          <div className="bg-green-100 text-green-800 p-4 rounded-md mb-6">
            <p className="font-semibold">✓ 已连接到手机</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">接收到的数据</h2>
            {receivedData.length > 0 ? (
              <ul className="divide-y">
                {receivedData.map((message, index) => (
                  <li key={index} className="py-3">
                    <p className="break-all text-gray-900">{message}</p>
                    <p className="text-xs text-gray-500 mt-1">{new Date().toLocaleTimeString()}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-900">等待接收数据...</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}