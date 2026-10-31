using System;
using System.IO;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Text.Json;

public static class SpringNestRenderer
{
    struct C
    {
        public float R,G,B,A;
        public C(float r,float g,float b,float a){R=r;G=g;B=b;A=a;}
        public static C Mix(C x,C y,double q){float p=(float)q;return new C(x.R+(y.R-x.R)*p,x.G+(y.G-x.G)*p,x.B+(y.B-x.B)*p,x.A+(y.A-x.A)*p);}
    }
    sealed class Tex
    {
        public int W,H;
        public C[] P;
        public Tex(string path)
        {
            using(Bitmap bmp=new Bitmap(path))
            {
                W=bmp.Width;H=bmp.Height;P=new C[W*H];
                Rectangle rect=new Rectangle(0,0,W,H);
                BitmapData data=bmp.LockBits(rect,ImageLockMode.ReadOnly,PixelFormat.Format32bppArgb);
                byte[] bytes=new byte[Math.Abs(data.Stride)*H];
                Marshal.Copy(data.Scan0,bytes,0,bytes.Length);
                for(int y=0;y<H;y++)for(int x=0;x<W;x++)
                {
                    int k=y*data.Stride+x*4;
                    P[y*W+x]=new C(bytes[k+2]/255f,bytes[k+1]/255f,bytes[k]/255f,bytes[k+3]/255f);
                }
                bmp.UnlockBits(data);
            }
        }
        public C Sample(double x,double y)
        {
            x=Math.Clamp(x,0,W-1.001);y=Math.Clamp(y,0,H-1.001);
            int ix=(int)x,iy=(int)y;float fx=(float)(x-ix),fy=(float)(y-iy);
            C a=P[iy*W+ix],b=P[iy*W+ix+1],c=P[(iy+1)*W+ix],d=P[(iy+1)*W+ix+1];
            float wa=(1-fx)*(1-fy),wb=fx*(1-fy),wc=(1-fx)*fy,wd=fx*fy;
            float al=a.A*wa+b.A*wb+c.A*wc+d.A*wd;
            if(al<0.00001)return new C(0,0,0,0);
            return new C((a.R*a.A*wa+b.R*b.A*wb+c.R*c.A*wc+d.R*d.A*wd)/al,(a.G*a.A*wa+b.G*b.A*wb+c.G*c.A*wc+d.G*d.A*wd)/al,(a.B*a.A*wa+b.B*b.A*wb+c.B*c.A*wc+d.B*d.A*wd)/al,al);
        }
    }
    struct V
    {
        public double X,Y,Z,U,T;
        public V(double x,double y,double z,double u,double t){X=x;Y=y;Z=z;U=u;T=t;}
    }
    struct W
    {
        public double U,V,Z;
        public W(double u,double v,double z){U=u;V=v;Z=z;}
    }
    sealed class Fall
    {
        public double[][] Rows;
        public double Phase;
        public C[] Field=new C[96*96];
        public C[] Mean=new C[96];
        public void Bounds(double y,out double left,out double right)
        {
            int i=0;
            while(i<Rows.Length-2 && y>Rows[i+1][0])i++;
            double q=Math.Clamp((y-Rows[i][0])/(Rows[i+1][0]-Rows[i][0]),0,1);
            left=Rows[i][1]+(Rows[i+1][1]-Rows[i][1])*q;
            right=Rows[i][2]+(Rows[i+1][2]-Rows[i][2])*q;
        }
    }
    static Tex original,underpaint,front,back,edge,ripple,drop;
    static C[] canvas,layer;
    static double[] depth;
    static float[] cavity,rim,hub,pool;
    static Fall[] falls;
    static double cx,cy,ru,rv,dx,dy,period,paddleHalf,paddleMiddle,paddleThickness;
    static int fps,frameCount,paddleCount;
    const int S=2,LX=76,LY=242,LW=224,LH=216;
    static double Frac(double x){return x-Math.Floor(x);}
    static C Underpainting(double x,double y)
    {
        C c=underpaint.Sample(x-68,y-240);
        if(c.R>c.B*1.08 && c.R>c.G && c.R>0.2){c.R*=0.76f;c.G*=0.76f;c.B*=0.76f;}
        return c;
    }
    static C Over(C dst,C src)
    {
        float a=src.A+dst.A*(1-src.A);
        if(a<0.00001)return new C(0,0,0,0);
        return new C((src.R*src.A+dst.R*dst.A*(1-src.A))/a,(src.G*src.A+dst.G*dst.A*(1-src.A))/a,(src.B*src.A+dst.B*dst.A*(1-src.A))/a,a);
    }
    static void Save(string path,C[] pixels,int w,int h)
    {
        using(Bitmap bmp=new Bitmap(w,h,PixelFormat.Format32bppArgb))
        {
            BitmapData data=bmp.LockBits(new Rectangle(0,0,w,h),ImageLockMode.WriteOnly,PixelFormat.Format32bppArgb);
            byte[] bytes=new byte[data.Stride*h];
            for(int y=0;y<h;y++)for(int x=0;x<w;x++)
            {
                C p=pixels[y*w+x];int k=y*data.Stride+x*4;
                bytes[k]=(byte)Math.Clamp((int)Math.Round(p.B*255),0,255);
                bytes[k+1]=(byte)Math.Clamp((int)Math.Round(p.G*255),0,255);
                bytes[k+2]=(byte)Math.Clamp((int)Math.Round(p.R*255),0,255);
                bytes[k+3]=(byte)Math.Clamp((int)Math.Round(p.A*255),0,255);
            }
            Marshal.Copy(bytes,0,data.Scan0,bytes.Length);bmp.UnlockBits(data);bmp.Save(path,ImageFormat.Png);
        }
    }
    static float[] Mask(GraphicsPath path,string output)
    {
        using(Bitmap big=new Bitmap(2048,2048,PixelFormat.Format32bppArgb))
        using(Graphics g=Graphics.FromImage(big))
        using(Bitmap small=new Bitmap(512,512,PixelFormat.Format32bppArgb))
        using(Graphics h=Graphics.FromImage(small))
        {
            g.SmoothingMode=SmoothingMode.AntiAlias;g.ScaleTransform(4,4);g.FillPath(Brushes.White,path);
            h.InterpolationMode=InterpolationMode.HighQualityBicubic;h.DrawImage(big,new Rectangle(0,0,512,512));
            small.Save(output,ImageFormat.Png);
        }
        Tex tex=new Tex(output);float[] mask=new float[512*512];
        for(int i=0;i<mask.Length;i++)mask[i]=tex.P[i].A;
        return mask;
    }
    static V Project(W p,double u,double v)
    {
        return new V((cx+ru*p.U+dx*p.Z-LX)*S,(cy+rv*p.V+dy*p.Z-LY)*S,dx/ru*p.U+dy/rv*p.V-p.Z,u,v);
    }
    static double E(V a,V b,double x,double y){return (x-a.X)*(b.Y-a.Y)-(y-a.Y)*(b.X-a.X);}
    static void Tri(V a,V b,V c,Tex tex,double shade,bool zOnly)
    {
        double area=E(b,c,a.X,a.Y);if(Math.Abs(area)<0.0001)return;
        int minX=Math.Max(0,(int)Math.Floor(Math.Min(a.X,Math.Min(b.X,c.X))));
        int maxX=Math.Min(LW-1,(int)Math.Ceiling(Math.Max(a.X,Math.Max(b.X,c.X))));
        int minY=Math.Max(0,(int)Math.Floor(Math.Min(a.Y,Math.Min(b.Y,c.Y))));
        int maxY=Math.Min(LH-1,(int)Math.Ceiling(Math.Max(a.Y,Math.Max(b.Y,c.Y))));
        for(int y=minY;y<=maxY;y++)for(int x=minX;x<=maxX;x++)
        {
            double w0=E(b,c,x+0.5,y+0.5)/area,w1=E(c,a,x+0.5,y+0.5)/area,w2=1-w0-w1;
            if(w0<0 || w1<0 || w2<0)continue;
            double z=w0*a.Z+w1*b.Z+w2*c.Z;int i=y*LW+x;
            if(z<depth[i]-0.000001)continue;
            if(zOnly){depth[i]=z;continue;}
            double tu=w0*a.U+w1*b.U+w2*c.U,tv=w0*a.T+w1*b.T+w2*c.T;
            C color=tex.Sample((0.05+0.90*tu)*(tex.W-1),(0.12+0.76*tv)*(tex.H-1));
            if(color.A<0.5)color=tex.Sample(Math.Clamp(tu,0.12,0.88)*(tex.W-1),Math.Clamp(tv,0.2,0.8)*(tex.H-1));
            color.A=1;
            color.R=(float)Math.Clamp(color.R*shade,0,1);color.G=(float)Math.Clamp(color.G*shade,0,1);color.B=(float)Math.Clamp(color.B*shade,0,1);
            depth[i]=z;layer[i]=Over(layer[i],color);
        }
    }
    static void Quad(W a,W b,W c,W d,Tex tex,double shade,bool zOnly)
    {
        V p=Project(a,0,0),q=Project(b,1,0),r=Project(c,1,1),s=Project(d,0,1);
        Tri(p,q,r,tex,shade,zOnly);Tri(p,r,s,tex,shade,zOnly);
    }
    static W P(double angle,double radial,double tangent,double z)
    {
        return new W(Math.Cos(angle)*radial-Math.Sin(angle)*tangent,Math.Sin(angle)*radial+Math.Cos(angle)*tangent,z);
    }
    static W Rounded(double angle,double x,double y,double z)
    {
        double radius=0.035,ix=Math.Clamp(x,-0.5+radius,0.5-radius),iy=Math.Clamp(y,-paddleHalf+radius,paddleHalf-radius),iz=Math.Clamp(z,-paddleThickness+radius,paddleThickness-radius);
        double a=x-ix,b=y-iy,c=z-iz,length=Math.Sqrt(a*a+b*b+c*c);
        double rx=ix+a/length*radius,ry=iy+b/length*radius,rz=iz+c/length*radius;
        return P(angle,paddleMiddle+rz,ry,0.5+rx);
    }
    static void RoundedFace(double angle,int axis,int sign,Tex texture,double shade)
    {
        int nx=axis==0?8:24,ny=axis==2?8:6;
        double[] half={0.5,paddleHalf,paddleThickness};
        int uAxis=axis==0?1:0,vAxis=axis==2?1:2;
        for(int iy=0;iy<ny;iy++)for(int ix=0;ix<nx;ix++)
        {
            W[] points=new W[4];
            double[] us={ix/(double)nx,(ix+1)/(double)nx,(ix+1)/(double)nx,ix/(double)nx};
            double[] vs={iy/(double)ny,iy/(double)ny,(iy+1)/(double)ny,(iy+1)/(double)ny};
            V[] projected=new V[4];
            for(int k=0;k<4;k++)
            {
                double[] c=new double[3];c[axis]=sign*half[axis];c[uAxis]=(us[k]*2-1)*half[uAxis];c[vAxis]=(vs[k]*2-1)*half[vAxis];
                points[k]=Rounded(angle,c[0],c[1],c[2]);projected[k]=Project(points[k],us[k],vs[k]);
            }
            double blend=Math.Min(Math.Min(ix+0.5,nx-ix-0.5)/2.0,Math.Min(iy+0.5,ny-iy-0.5)/1.5);
            double localShade=shade+(1-Math.Clamp(blend,0,1))*0.045;
            Tri(projected[0],projected[1],projected[2],texture,localShade,false);Tri(projected[0],projected[2],projected[3],texture,localShade,false);
        }
    }
    static void Cylinder()
    {
        int segments=96;
        for(int k=0;k<segments;k++)
        {
            double a=k*2*Math.PI/segments,b=(k+1)*2*Math.PI/segments;
            Quad(P(a,0.90,0,0),P(a,0.90,0,1),P(b,0.90,0,1),P(b,0.90,0,0),null,1,true);
            V center=Project(new W(0,0,0),0.5,0.5);
            V p=Project(P(a,0.91,0,0),0.5+0.40*Math.Cos(a),0.5+0.40*Math.Sin(a));
            V q=Project(P(b,0.91,0,0),0.5+0.40*Math.Cos(b),0.5+0.40*Math.Sin(b));
            Tri(center,p,q,back,0.42,false);
        }
    }
    static void Wheel(double t)
    {
        Array.Fill(depth,double.NegativeInfinity);Array.Clear(layer,0,layer.Length);Cylinder();
        double rotation=t/period*2*Math.PI;
        for(int k=0;k<6;k++)
        {
            double a=rotation+k*2*Math.PI/6;
            Quad(P(a,0.08,-0.035,-0.025),P(a,0.90,-0.035,-0.025),P(a,0.90,0.035,-0.025),P(a,0.08,0.035,-0.025),front,0.52,false);
        }
        for(int k=0;k<paddleCount;k++)
        {
            double a=rotation+k*2*Math.PI/paddleCount-Math.PI/2;
            double u=Math.Cos(a),v=Math.Sin(a);
            double radialVisible=dx/ru*u+dy/rv*v;
            double tangentVisible=-dx/ru*v+dy/rv*u;
            double radialShade=0.87+0.13*Math.Max(0,-0.35*u-0.85*v);
            if(radialVisible>0)RoundedFace(a,2,1,front,radialShade);
            if(radialVisible<0)RoundedFace(a,2,-1,back,0.77);
            if(tangentVisible>0)RoundedFace(a,1,1,edge,0.95);
            if(tangentVisible<0)RoundedFace(a,1,-1,edge,0.86);
            RoundedFace(a,0,-1,back,0.91);
        }
        for(int y=0;y<LH/S;y++)for(int x=0;x<LW/S;x++)
        {
            float ar=0,r=0,g=0,b=0;
            for(int yy=0;yy<S;yy++)for(int xx=0;xx<S;xx++)
            {
                C c=layer[(y*S+yy)*LW+x*S+xx];ar+=c.A;r+=c.R*c.A;g+=c.G*c.A;b+=c.B*c.A;
            }
            if(ar<0.001)continue;
            int i=(y+LY)*512+x+LX;
            C color=new C(r/ar,g/ar,b/ar,ar/(S*S)*cavity[i]);
            canvas[i]=Over(canvas[i],color);
        }
        for(int y=250;y<352;y++)for(int x=76;x<183;x++)
        {
            int i=y*512+x;float amount=Math.Max(rim[i],hub[i]);
            if(amount>0)canvas[i]=C.Mix(canvas[i],original.P[i],amount);
        }
    }
    static void Surface(double t)
    {
        double phase=2*Math.PI*t/period;
        for(int y=330;y<=401;y++)for(int x=105;x<=443;x++)
        {
            int i=y*512+x;double weight=pool[i];
            if(weight<=0)continue;
            double ox=(0.54*Math.Sin(phase*2+y*0.16)+0.21*Math.Sin(phase*3+x*0.10))*weight;
            double oy=0.25*Math.Cos(phase*2+x*0.11)*weight;
            canvas[i]=original.Sample(x+ox,y+oy);
        }
        for(int y=228;y<251;y++)for(int x=126;x<251;x++)
        {
            double u=(x-188)/61.0,v=(y-240)/11.0;
            double weight=Math.Clamp((1-u*u-v*v)*3,0,1);
            if(weight>0)canvas[y*512+x]=original.Sample(x+0.3*Math.Sin(phase*2+y*0.21)*weight,y+0.14*Math.Cos(phase*2+x*0.13)*weight);
        }
    }
    static C Field(Fall f,double u,double v)
    {
        u=Math.Clamp(u,0,0.9999);v=Math.Clamp(v,0,0.9999);
        double x=u*95,y=v*95;int ix=(int)x,iy=(int)y;
        return C.Mix(C.Mix(f.Field[iy*96+ix],f.Field[iy*96+ix+1],x-ix),C.Mix(f.Field[(iy+1)*96+ix],f.Field[(iy+1)*96+ix+1],x-ix),y-iy);
    }
    static void Water(double t)
    {
        for(int k=0;k<falls.Length;k++)
        {
            Fall f=falls[k];double y0=f.Rows[0][0],y1=f.Rows[f.Rows.Length-1][0];
            for(int y=(int)y0;y<=y1;y++)
            {
                f.Bounds(y,out double left,out double right);
                for(int x=(int)left;x<=right;x++)
                {
                    double u=(x-left)/(right-left),v=(y-y0)/(y1-y0);
                    double weight=Math.Clamp(Math.Min(Math.Min((x-left)/1.5,(right-x)/1.5),Math.Min((y-y0)/1.7,(y1-y)/1.7)),0,1);
                    if(weight<=0)continue;
                    double uv=Frac(v-t*1.0+f.Phase);
                    double uu=Math.Clamp(u+0.012*Math.Sin(v*5+t*Math.PI*2),0,0.999);
                    C baseColor=original.P[y*512+x],sample=Field(f,uu,uv),mean=f.Mean[Math.Clamp((int)(u*95),0,95)];
                    double window=Math.Pow(Math.Sin(Math.PI*uv),2);
                    C color=new C((float)(0.58*baseColor.R+0.42*mean.R+0.42*window*(sample.R-mean.R)),(float)(0.58*baseColor.G+0.42*mean.G+0.42*window*(sample.G-mean.G)),(float)(0.58*baseColor.B+0.42*mean.B+0.42*window*(sample.B-mean.B)),1);
                    int i=y*512+x;canvas[i]=C.Mix(canvas[i],color,weight);
                }
            }
        }
    }
    static void Sprite(Tex tex,double x,double y,double w,double h,double opacity,bool poolClip)
    {
        int x0=Math.Max(0,(int)(x-w/2-1)),x1=Math.Min(511,(int)(x+w/2+1));
        int y0=Math.Max(0,(int)(y-h/2-1)),y1=Math.Min(511,(int)(y+h/2+1));
        for(int yy=y0;yy<=y1;yy++)for(int xx=x0;xx<=x1;xx++)
        {
            double u=(xx+0.5-(x-w/2))/w,v=(yy+0.5-(y-h/2))/h;
            if(u<0 || u>1 || v<0 || v>1)continue;
            C c=tex.Sample(u*(tex.W-1),v*(tex.H-1));int i=yy*512+xx;
            c.A*=(float)(opacity*(poolClip?pool[i]:1));canvas[i]=Over(canvas[i],c);
        }
    }
    static void Effects(double t)
    {
        for(int k=2;k>=0;k--)
        {
            double age=(Frac(t*2)+k)/3.0;
            Sprite(ripple,279-11*age,335+18*age,14+135*age,1.2+10*age,0.46*Math.Pow(1-age,1.8),true);
        }
        for(int k=0;k<5;k++)
        {
            double age=Frac(t*2+k*0.173),dt=age*0.48;
            double alpha=Math.Pow(Math.Sin(Math.PI*age),0.65)*0.92;
            double x=174+(k-1.6)*5.0*dt,y=332-(28+k*2.5)*dt+80*dt*dt;
            Sprite(drop,x,y,1.7+(k%2)*0.6,2.7+(k%2)*0.7,alpha,false);
        }
    }
    public static void Run(string root,int limit)
    {
        JsonDocument json=JsonDocument.Parse(File.ReadAllText(Path.Combine(root,"rig.json")));
        JsonElement rig=json.RootElement,wheel=rig.GetProperty("wheel");
        fps=rig.GetProperty("fps").GetInt32();frameCount=rig.GetProperty("frameCount").GetInt32();period=rig.GetProperty("periodMs").GetDouble()/1000;
        cx=wheel.GetProperty("center")[0].GetDouble();cy=wheel.GetProperty("center")[1].GetDouble();
        ru=wheel.GetProperty("planeU")[0].GetDouble();rv=wheel.GetProperty("planeV")[1].GetDouble();dx=wheel.GetProperty("depth")[0].GetDouble();dy=wheel.GetProperty("depth")[1].GetDouble();
        paddleCount=wheel.GetProperty("paddleCount").GetInt32();
        paddleHalf=wheel.GetProperty("paddleWidth").GetDouble()/2;
        paddleMiddle=(wheel.GetProperty("paddleRadialThickness")[0].GetDouble()+wheel.GetProperty("paddleRadialThickness")[1].GetDouble())/2;
        paddleThickness=(wheel.GetProperty("paddleRadialThickness")[1].GetDouble()-wheel.GetProperty("paddleRadialThickness")[0].GetDouble())/2;
        string parts=Path.Combine(root,"Parts");original=new Tex(Path.Combine(root,"Sources","reference.png"));
        underpaint=new Tex(Path.Combine(parts,"wheel-underpainting.png"));front=new Tex(Path.Combine(parts,"paddle-front.png"));back=new Tex(Path.Combine(parts,"paddle-back.png"));edge=new Tex(Path.Combine(parts,"paddle-edge.png"));
        ripple=new Tex(Path.Combine(root,"Sources","ripple-ring.png"));drop=new Tex(Path.Combine(parts,"droplet.png"));
        using(GraphicsPath p=new GraphicsPath())
        {
            p.AddPolygon(new PointF[]{new PointF(85,247),new PointF(135,246),new PointF(156,260),new PointF(169,281),new PointF(180,321),new PointF(171,332),new PointF(134,335),new PointF(120,332),new PointF(110,319),new PointF(96,312),new PointF(91,285),new PointF(86,270)});
            cavity=Mask(p,Path.Combine(parts,"wheel-clip.png"));
        }
        using(GraphicsPath p=new GraphicsPath())
        {
            p.AddBezier(86,260,110,261,131,281,135,307);p.AddBezier(135,307,136,325,130,342,124,349);
            p.AddLine(124,349,118,347);p.AddBezier(118,347,123,328,120,309,113,291);p.AddBezier(113,291,105,277,95,270,85,269);p.CloseFigure();
            rim=Mask(p,Path.Combine(parts,"near-rim-mask.png"));
        }
        for(int i=0;i<rim.Length;i++)rim[i]*=(float)Math.Clamp((original.P[i].R-original.P[i].B+0.025)/0.10,0,1);
        using(GraphicsPath p=new GraphicsPath()){p.AddEllipse(78,290,27,32);hub=Mask(p,Path.Combine(parts,"axle-mask.png"));}
        C[] rimPart=new C[512*512],axlePart=new C[512*512];
        for(int i=0;i<rim.Length;i++){rimPart[i]=original.P[i];rimPart[i].A*=rim[i];axlePart[i]=original.P[i];axlePart[i].A*=hub[i];}
        Save(Path.Combine(parts,"near-rim.png"),rimPart,512,512);Save(Path.Combine(parts,"axle.png"),axlePart,512,512);
        using(GraphicsPath p=new GraphicsPath())
        {
            p.AddPolygon(new PointF[]{new PointF(110,352),new PointF(188,336),new PointF(310,334),new PointF(401,341),new PointF(436,354),new PointF(427,375),new PointF(366,390),new PointF(301,398),new PointF(220,399),new PointF(149,386),new PointF(113,368)});
            pool=Mask(p,Path.Combine(parts,"pool-mask.png"));
        }
        JsonElement water=rig.GetProperty("waterfalls");falls=new Fall[water.GetArrayLength()];
        for(int k=0;k<falls.Length;k++)
        {
            Fall f=new Fall();f.Phase=water[k].GetProperty("phase").GetDouble();JsonElement rows=water[k].GetProperty("rows");f.Rows=new double[rows.GetArrayLength()][];
            for(int i=0;i<f.Rows.Length;i++)f.Rows[i]=new double[]{rows[i][0].GetDouble(),rows[i][1].GetDouble(),rows[i][2].GetDouble()};
            for(int v=0;v<96;v++)
            {
                double y=f.Rows[0][0]+(f.Rows[f.Rows.Length-1][0]-f.Rows[0][0])*v/95;
                f.Bounds(y,out double l,out double r);
                for(int u=0;u<96;u++)f.Field[v*96+u]=original.Sample(l+(r-l)*u/95,y);
            }
            for(int u=0;u<96;u++)
            {
                float r=0,g=0,b=0;for(int v=0;v<96;v++){C c=f.Field[v*96+u];r+=c.R;g+=c.G;b+=c.B;}
                f.Mean[u]=new C(r/96,g/96,b/96,1);
            }
            falls[k]=f;
            Save(Path.Combine(parts,"water-"+water[k].GetProperty("name").GetString()+".png"),f.Field,96,96);
        }
        layer=new C[LW*LH];depth=new double[LW*LH];Directory.CreateDirectory(Path.Combine(root,"Frames"));
        int count=limit>0?Math.Min(limit,frameCount):frameCount+1;
        for(int frame=0;frame<count;frame++)
        {
            double t=frame/(double)fps;canvas=(C[])original.P.Clone();Surface(t);
            for(int y=244;y<340;y++)for(int x=83;x<182;x++)
            {
                int i=y*512+x;double a=cavity[i];if(a>0)canvas[i]=C.Mix(canvas[i],Underpainting(x,y),a);
            }
            Wheel(t);Water(t);Effects(t);
            string output=frame==frameCount?Path.Combine(root,"loop-end-check.png"):Path.Combine(root,"Frames","frame-"+frame.ToString("000")+".png");
            Save(output,canvas,512,512);
            if(frame==0)
            {
                Save(Path.Combine(root,"keypose.png"),canvas,512,512);
                C[] baseLayer=(C[])original.P.Clone();
                for(int y=244;y<340;y++)for(int x=83;x<182;x++){int i=y*512+x;if(cavity[i]>0)baseLayer[i]=C.Mix(baseLayer[i],Underpainting(x,y),cavity[i]);}
                Save(Path.Combine(parts,"stationary-underlayer.png"),baseLayer,512,512);
            }
        }
        json.Dispose();
    }
}

