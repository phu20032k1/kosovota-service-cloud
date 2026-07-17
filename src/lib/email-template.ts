export function activationEmail(data:{
    name:string,
    deviceCode:string,
    date:string,
    warranty:string
}){

return `

<div style="
font-family:Arial;
max-width:600px;
margin:auto;
border:1px solid #ddd;
padding:30px;
">

<h2>
KOSO VOTA
</h2>


<p>
Xin chào <b>${data.name}</b>
</p>


<p>
Thiết bị của bạn đã được kích hoạt thành công.
</p>


<h3>
Thông tin thiết bị
</h3>


<table>

<tr>
<td>Mã thiết bị:</td>
<td>${data.deviceCode}</td>
</tr>


<tr>
<td>Ngày kích hoạt:</td>
<td>${data.date}</td>
</tr>


<tr>
<td>Bảo hành:</td>
<td>${data.warranty}</td>
</tr>


</table>


<br/>


<p>
Cảm ơn Quý khách đã sử dụng sản phẩm KOSO VOTA.
</p>


<hr/>


<p>
Hotline CSKH: xxx
</p>


</div>

`

}