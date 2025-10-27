import axios from "axios";
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { baseUrl } from "../../url";

export default function ExperienceDetails(props) {
  const { id } = useParams()
  const [data, setData] = useState()

  useEffect(()=>{
    axios.get(`${baseUrl}/trip/${id}`)
    .then((res) => {
      console.log(res.data)
      setData(res.data)
    })
  },[id])
  if(data){
    return (
      <div style={{ margin: "2%" }}>
        <div className="row">
          <div className="col-2"></div>
          <div className="col-8" style={{ textAlign: "center" }}>
            <h1>{data.tripName}</h1>
          </div>
          <div className="col-2"></div>
        </div>
  
        <div className="row">
          <div className="col-2"></div>
          <div className="col-8" style={{ textAlign: "center" }}>
            <img
              src={data.image}
              alt="Tag"
            />
          </div>
          <div className="col-2"></div>
        </div>
        <br />
  
        <div className="container">
          <div className="row">
            <div className="col-3"></div>
            <div className="col-6 border bg-light">
              <div className="row">
                <div className="col-12">Name of Hotel: {data.nameOfHotels}</div>
              </div>
              <div className="row">
                <div className="col-6">Start Date: {data.startDateOfJourney}</div>
                <div className="col-6">End Date: {data.endDateOfJourney}</div>
              </div>
              <div className="row">
                <div className="col-12">Places Visited: {data.placesVisited}</div>
              </div>
              <div className="row">
                <div className="col-12">Total Cost: {data.totalCost}</div>
              </div>
              <div className="row">
                <div className="col-12">Trip Type: {data.tripType}</div>
              </div>
            </div>
            <div className="col-3"></div>
          </div>
        </div>
        <br />
        <div className="row">
          <div className="col-1"></div>
          <div className="col-10" style={{ textAlign: "justify"}}>
          {data.experience}
          </div>
          <div className="col-1"></div>
        </div>
      </div>
    );
  }else{
    return(<>
    Loading...
    </>)
  }
  
}
