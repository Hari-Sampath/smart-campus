/* Offline actuator boundary. This adapter validates and logs; it never opens a device connection. */
class DryRunAdapter{
 constructor(){this.log=[]}
 command(kind,target,detail,allowed,reason){this.log.push({kind,target,detail,status:allowed?'WOULD SEND':'BLOCKED',reason})}
 setpoint(room,value){const known=rooms.some(r=>r.n===room),ok=known&&value>=24&&value<=28;this.command('BACnet analog write',room,`setpoint ${value.toFixed(1)}°C`,ok,ok?'allowlisted classroom point and 24–28°C guard':'rejected: room is unknown or setpoint is outside 24–28°C')}
 classroomPower(room,state,occupied){const known=rooms.some(r=>r.n===room),ok=known&&!(state==='off'&&occupied);this.command('BACnet binary write',room,`AC ${state}`,ok,ok?'classroom target; occupied-room off guard passed':'rejected: cannot switch an occupied classroom off')}
 serverPower(server,state,assigned){const node=SV.find(s=>s.n===server),ok=!!node&&!node.ao&&!assigned;this.command('Slurm power request',server,`state=${state}`,ok,ok?'compute node is not pinned on and has no assigned work':'rejected: protected node or node has scheduled work')}
}
function adapterDryRun(){const a=new DryRunAdapter(),d=st.d,h=st.h;
 rooms.slice(0,4).forEach(r=>{const x=decide(r,d,h),c=TT[r.n][d][h];if(x.set!==null)a.setpoint(r.n,x.set);else if(x.st==='Off')a.classroomPower(r.n,'off',!!c);});
 /* Deliberate negative cases demonstrate policy enforcement; these are never device calls. */
 if(rooms[0])a.setpoint(rooms[0].n,18);
 const protectedNode=SV.find(s=>s.ao);if(protectedNode)a.serverPower(protectedNode.n,'POWER_DOWN',false);
 const p=pick();SV.filter((s,j)=>!s.ao&&!p.g.includes(j)).slice(0,2).forEach(s=>a.serverPower(s.n,'POWER_DOWN',false));
 return a.log}
