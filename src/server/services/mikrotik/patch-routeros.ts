import { Channel } from 'node-routeros'

/**
 * Patch node-routeros for MikroTik RouterOS v7.18+ compatibility.
 * 
 * In RouterOS 7.18+, commands/queries returning 0 items send an '!empty' sentence before '!done'.
 * node-routeros does not recognize '!empty' and throws RosException('UNKNOWNREPLY', { reply: '!empty' }).
 * This patch intercepts '!empty' in Channel.prototype.processPacket so the library cleanly
 * waits for the subsequent '!done' and returns [] without throwing an error.
 */
export function patchRouterOS7EmptyReply(): void {
  if (!Channel || !Channel.prototype || (Channel.prototype as any)._ros7EmptyPatched) {
    return
  }
  (Channel.prototype as any)._ros7EmptyPatched = true

  const proto = Channel.prototype as any
  const originalProcessPacket = proto.processPacket
  proto.processPacket = function (packet: string[]) {
    if (packet && packet.length > 0 && packet[0] === '!empty') {
      // RouterOS 7.18+ reply: command executed successfully with 0 items.
      // Safely consume !empty sentence and wait for subsequent !done packet.
      packet.shift()
      return
    }
    return originalProcessPacket.call(this, packet)
  }
}

// Auto-patch on module evaluation
patchRouterOS7EmptyReply()
