#/bin/sh
#
# Use iptables (on a Linux system) to route http and https packets to
# an instance of offlineweb
#
# Usage: sudo ./webroute.sh <ipaddress> [remove]
#   where <ipaddress> is the address of an offlineweb instance
#   optional parameter 'remove' will remove the iptables entry 
#

iptables -t nat -D OUTPUT -p tcp --dport 80 -j DNAT --to-destination $1:80 2>/dev/null
iptables -t nat -D OUTPUT -p tcp --dport 443 -j DNAT --to-destination $1:443 2>/dev/null
if [ "OPT $2" != "OPT remove" ]
then
  echo "Routing web requests to $1"
  iptables -t nat -A OUTPUT -p tcp --dport 80 -j DNAT --to-destination $1:80
  iptables -t nat -A OUTPUT -p tcp --dport 443 -j DNAT --to-destination $1:443
  if [ ! -f ".resolv.conf.old" ]
  then
    cp /etc/resolv.conf .resolv.conf.old
  fi
  echo "nameserver 172.20.0.101" > /etc/resolv.conf
else
  echo "Removing entries to route requests"
  cp .resolv.conf.old /etc/resolv.conf
fi
