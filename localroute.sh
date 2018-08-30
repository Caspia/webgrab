#/bin/sh
#
# Use iptables (on a Linux system) to route http and https packets to
# a local instance of offlineweb
#
# Usage: sudo ./localroute.sh [remove]
#

# The address of the offlineweb server
OFFLINEWEB_IP=172.20.0.100
# The IP address of the dnsmasq server
DNS_IP=172.20.0.101

iptables -t nat -D OUTPUT -p tcp ! -s $OFFLINEWEB_IP --dport 80 -j DNAT --to-destination $OFFLINEWEB_IP:3129 2>/dev/null
iptables -t nat -D OUTPUT -p tcp ! -s $OFFLINEWEB_IP --dport 443 -j DNAT --to-destination $OFFLINEWEB_IP:3130 2>/dev/null
iptables -t nat -D PREROUTING -p tcp ! -s $OFFLINEWEB_IP --dport 80 -j DNAT --to-destination $OFFLINEWEB_IP:3129 2>/dev/null
iptables -t nat -D PREROUTING -p tcp ! -s $OFFLINEWEB_IP --dport 443 -j DNAT --to-destination $OFFLINEWEB_IP:3130 2>/dev/null
iptables -t nat -D PREROUTING -p tcp ! -s $OFFLINEWEB_IP --dport 53 -j DNAT --to-destination $DNS_IP:53 2>/dev/null
iptables -t nat -D PREROUTING -p udp ! -s $OFFLINEWEB_IP --dport 53 -j DNAT --to-destination $DNS_IP:53] 2>/dev/null
iptables -P FORWARD DROP
if [ "OPT $1" != "OPT remove" ]
then
  echo "Routing web requests to local beluga/offlineweb instance"
  iptables -t nat -A OUTPUT -p tcp ! -s $OFFLINEWEB_IP --dport 80 -j DNAT --to-destination $OFFLINEWEB_IP:3129
  iptables -t nat -A OUTPUT -p tcp ! -s $OFFLINEWEB_IP --dport 443 -j DNAT --to-destination $OFFLINEWEB_IP:3130
  iptables -t nat -A PREROUTING -p tcp ! -s $OFFLINEWEB_IP --dport 80 -j DNAT --to-destination $OFFLINEWEB_IP:3129
  iptables -t nat -A PREROUTING -p tcp ! -s $OFFLINEWEB_IP --dport 443 -j DNAT --to-destination $OFFLINEWEB_IP:3130
  iptables -t nat -A PREROUTING -p tcp ! -s $OFFLINEWEB_IP --dport 53 -j DNAT --to-destination $DNS_IP:53
  iptables -t nat -A PREROUTING -p udp ! -s $OFFLINEWEB_IP --dport 53 -j DNAT --to-destination $DNS_IP:53]
  iptables -P FORWARD ACCEPT
  if [ ! -f ".resolv.conf.old" ]
  then
    cp /etc/resolv.conf .resolv.conf.old
  fi
  echo "nameserver $DNS_IP" > /etc/resolv.conf
else
  echo "Removing routing of web requests to local beluga/offlineweb instance"
  cp .resolv.conf.old /etc/resolv.conf
fi
