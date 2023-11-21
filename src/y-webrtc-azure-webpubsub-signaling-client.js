import { WebrtcProvider, SignalingConn, publishSignalingMessage } from 'y-webrtc'
import { WebPubSubClient } from "@azure/web-pubsub-client"

export class AzureWebPubSubSignalingConn extends SignalingConn {
  constructor (url) {
    super(url)
    this.connected = false
  }

  setupClient() {
    this.client = new WebPubSubClient(this.url)
    this.client.on('connected', e => {
      this.connected = true
      log(`connected (${url}) with ID ${e.connectionId}`)
      // Join all the groups.
      const groups = Array.from(rooms.keys())
      groups.forEach(group =>
        this.subscribe(group)
      )
      rooms.forEach(room =>
        publishSignalingMessage(this, room, { type: 'announce', from: room.peerId })
      )
    })
    this.client.on('disconnected', e => log(`disconnect (${url}): ${e.message}`))
    this.client.on('stopped', () => log(`stopped (${url})`))
    // Set an event handler for group messages before connecting, so we don't miss any.
    this.client.on('group-message', e => {
      this.handleMessage(e.message.group, e.message.data)
    })
    // Connect to the signaling server.
    this.client.start()
  }

  connected () {
    return this.connected
  }

  subscribe (roomName) {
    this.client.joinGroup(roomName)
  }

  unsubscribe (roomName) {
    this.client.leaveGroup(roomName)
  }

  publish (roomName, message) {
    let messageType = "json"
    if (typeof message === 'string') {
      messageType = "text"
    }
    this.client.sendToGroup(roomName, message, messageType)
  }

  destroy () {
    this.client.stop()
  }
}

export class AzureWebPubSubSignalingWebrtcProvider extends WebrtcProvider {
  connect () {
    this.shouldConnect = true
    this.signalingUrls.forEach(url => {
      const signalingConn = map.setIfUndefined(signalingConns, url, () => new AzureWebPubSubSignalingConn(url))
      this.signalingConns.push(signalingConn)
      signalingConn.providers.add(this)
    })
    if (this.room) {
      this.room.connect()
    }
  }
}